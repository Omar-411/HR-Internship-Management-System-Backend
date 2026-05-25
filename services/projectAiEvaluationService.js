import Project from "../models/Project.js";
import TeamMember from "../models/TeamMember.js";
import User from "../models/User.js";
import { resolveId } from "../utils/idResolver.js";
import AppError from "../utils/AppError.js";
import fetch from "node-fetch";
import pdfModule from "pdf-parse";

const pdf = pdfModule.default || pdfModule;
let evaluateProjectCandidatesFn;

async function getEvaluateProjectCandidates() {
  if (!evaluateProjectCandidatesFn) {
    const aiApp = await import("../ai/app.js");
    evaluateProjectCandidatesFn = aiApp.evaluateProjectCandidates;
  }
  return evaluateProjectCandidatesFn;
}

const USER_SELECT = [
  "publicId",
  "name",
  "lastName",
  "gender",
  "email",
  "position",
  "bio",
  "isAvailable",
  "projectsCount",
  "profileImageURL",
  "cvURL",
  "cvPublicId",
  "department_id",
].join(" ");

function toPlain(doc) {
  return typeof doc?.toObject === "function" ? doc.toObject() : doc;
}

function normalizeCvTextMap(cvTexts = {}) {
  if (!cvTexts || typeof cvTexts !== "object") return new Map();
  return new Map(Object.entries(cvTexts).map(([key, value]) => [key, String(value || "")]));
}

function attachCvText(user, cvTextMap) {
  const plainUser = toPlain(user);
  const id = plainUser._id?.toString();
  const publicId = plainUser.publicId;
  const email = plainUser.email;
  const cvText =
    cvTextMap.get(id) ||
    cvTextMap.get(publicId) ||
    cvTextMap.get(email) ||
    plainUser.cvText ||
    plainUser.rawCvText ||
    plainUser.resumeText ||
    "";

  return {
    ...plainUser,
    cvText,
  };
}

function fullName(user) {
  return [user?.name, user?.lastName].filter(Boolean).join(" ").trim() || user?.email || "Candidate";
}

function hasReadableCvText(user) {
  return typeof user?.cvText === "string" && user.cvText.trim().length > 0;
}

function toExcludedCandidate(user, reason = "CV is missing or could not be parsed.") {
  return {
    candidateId: user?._id?.toString() || user?.id?.toString() || user?.publicId,
    userId: user?._id?.toString() || user?.id?.toString(),
    publicId: user?.publicId,
    candidateName: fullName(user),
    fullName: fullName(user),
    cvURL: user?.cvURL,
    reason,
  };
}

function buildCvWarning(excludedCandidates) {
  if (!excludedCandidates.length) return null;
  const noun = excludedCandidates.length === 1 ? "candidate" : "candidates";
  return `${excludedCandidates.length} ${noun} could not be evaluated because their CV data was missing or could not be parsed.`;
}

function buildEmptyEvaluationData(project, excludedCandidates = [], extraWarnings = []) {
  const warning = buildCvWarning(excludedCandidates);
  const warnings = [warning, ...extraWarnings].filter(Boolean);

  return {
    project: {
      id: project.publicId,
      name: project.name,
      requiredTech: project.requiredTech,
      preferredTech: project.preferredTech,
      rolesNeeded: project.rolesNeeded,
    },
    rankedCandidates: [],
    roleAssignments: [],
    excludedCandidates,
    warnings,
    aiSummary: {
      title: "Recommended Team Composition",
      overview: "No candidates could be evaluated because no readable CV text was available.",
      recommendations: [],
    },
    ranking: [],
    summary: {
      totalUsers: 0,
      assignedRoles: 0,
      topUser: null,
      topRole: null,
    },
  };
}

async function extractCvTextFromUrl(cvURL) {
  if (!cvURL) return "";
  try {
    const response = await fetch(cvURL);
    if (!response.ok) return "";
    const contentType = response.headers.get("content-type") || "";
    const buffer = Buffer.from(await response.arrayBuffer());
    const isPdfBuffer = buffer.subarray(0, 4).toString("utf8") === "%PDF";

    if (
      contentType.includes("pdf") ||
      contentType.includes("octet-stream") ||
      cvURL.toLowerCase().includes(".pdf") ||
      isPdfBuffer
    ) {
      const parsed = await pdf(buffer);
      return parsed.text || "";
    }

    if (contentType.startsWith("text/")) {
      return buffer.toString("utf8");
    }
  } catch {
    return "";
  }
  return "";
}

async function hydrateCvTexts(users, parseCvUrls) {
  if (!parseCvUrls) return users;
  return Promise.all(users.map(async (user) => {
    if (user.cvText || !user.cvURL) return user;
    return {
      ...user,
      cvText: await extractCvTextFromUrl(user.cvURL),
    };
  }));
}

async function getProjectCandidates(project, scope) {
  if (scope === "all") {
    return User.find({ status: "Active" }).select(USER_SELECT).populate("department_id", "name").lean();
  }

  if (scope === "supervisor") {
    return User.find({
      status: "Active",
      supervisor_id: project.productOwnerId,
    })
      .select(USER_SELECT)
      .populate("department_id", "name")
      .lean();
  }

  if (!project.team_id) {
    return User.find({
      status: "Active",
      supervisor_id: project.productOwnerId,
    })
      .select(USER_SELECT)
      .populate("department_id", "name")
      .lean();
  }

  const members = await TeamMember.find({
    teamId: project.team_id,
    isActiveInProject: { $ne: false },
  }).select("userId");

  const userIds = members.map((member) => member.userId).filter(Boolean);
  if (project.productOwnerId) userIds.push(project.productOwnerId);
  if (project.scrumMasterId) userIds.push(project.scrumMasterId);

  return User.find({ _id: { $in: [...new Set(userIds.map((id) => id.toString()))] } })
    .select(USER_SELECT)
    .populate("department_id", "name")
    .lean();
}

function canEvaluateProject(project, currentUser) {
  if (!currentUser) return false;
  const role = currentUser.role?.toLowerCase();
  if (role === "admin") return true;
  if (role === "supervisor") {
    return project.productOwnerId?.toString() === currentUser.id?.toString();
  }
  return false;
}

function toStoredAiError(error) {
  if (!error) return null;
  return {
    code: error.code || "AI_EVALUATION_FAILED",
    message: error.message || "Project AI evaluation failed.",
    details: error.details,
  };
}

export async function evaluateProjectCandidatesForBackend(projectIdentifier, options = {}) {
  const projectDoc = await Project.findOne(resolveId(projectIdentifier));
  const project = toPlain(projectDoc);
  if (!project) {
    throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND", "Check the project id, public id, or slug.");
  }

  if (!canEvaluateProject(project, options.currentUser)) {
    throw new AppError(
      "You are not allowed to generate AI insights for this project",
      403,
      "PROJECT_AI_EVALUATION_FORBIDDEN",
      "Only an admin or the project supervisor can generate AI insights.",
    );
  }

  const allowedScopes = ["all", "team", "supervisor"];
  const scope = allowedScopes.includes(options.scope) ? options.scope : "supervisor";
  const cvTextMap = normalizeCvTextMap(options.cvTexts);
  const users = await getProjectCandidates(project, scope);

  if (!users.length) {
    const data = buildEmptyEvaluationData(project, []);
    const response = {
      status: "Success",
      code: 200,
      message: "No users found for project AI evaluation.",
      data,
    };
    projectDoc.aiEvaluationStatus = "Generated";
    projectDoc.aiEvaluationResult = response.data;
    projectDoc.aiEvaluationError = null;
    projectDoc.aiEvaluatedAt = new Date();
    projectDoc.aiEvaluatedBy = options.currentUser?.id || null;
    await projectDoc.save();
    return response;
  }

  const usersWithProvidedCvText = users.map((user) => attachCvText(user, cvTextMap));
  const usersForEvaluation = await hydrateCvTexts(
    usersWithProvidedCvText,
    options.parseCvUrls !== false,
  );
  const excludedCandidates = usersForEvaluation
    .filter((user) => !hasReadableCvText(user))
    .map((user) => toExcludedCandidate(user));
  const eligibleUsers = usersForEvaluation.filter(hasReadableCvText);

  if (!eligibleUsers.length) {
    const data = buildEmptyEvaluationData(project, excludedCandidates);
    const response = {
      status: "Success",
      code: 200,
      message: "Project AI evaluation completed with no eligible CVs.",
      data,
    };
    projectDoc.aiEvaluationStatus = "Generated";
    projectDoc.aiEvaluationResult = response.data;
    projectDoc.aiEvaluationError = null;
    projectDoc.aiEvaluatedAt = new Date();
    projectDoc.aiEvaluatedBy = options.currentUser?.id || null;
    await projectDoc.save();
    return response;
  }

  const evaluateProjectCandidates = await getEvaluateProjectCandidates();
  const evaluation = await evaluateProjectCandidates({
    project,
    users: eligibleUsers,
    options: options.aiOptions || {},
  });
  const cvWarning = buildCvWarning(excludedCandidates);
  const evaluationWarnings = Array.isArray(evaluation.warnings) ? evaluation.warnings : [];
  const warnings = [cvWarning, ...evaluationWarnings].filter(Boolean);

  const response = {
    status: evaluation.success ? "Success" : "Failed",
    code: evaluation.success ? 200 : 500,
    message: evaluation.success
      ? "Project AI evaluation completed successfully!"
      : "Project AI evaluation failed.",
    data: evaluation.success ? {
      project: evaluation.project,
      rankedCandidates: evaluation.rankedCandidates || evaluation.ranking || [],
      roleAssignments: evaluation.roleAssignments || [],
      excludedCandidates,
      warnings,
      aiSummary: evaluation.aiSummary || {
        title: "Recommended Team Composition",
        overview: "AI evaluation completed, but no summary was returned.",
        recommendations: [],
      },
      ranking: evaluation.rankedCandidates || evaluation.ranking || [],
      summary: evaluation.summary,
    } : undefined,
    error: evaluation.success ? undefined : evaluation.error,
  };

  projectDoc.aiEvaluationStatus = evaluation.success ? "Generated" : "Failed";
  projectDoc.aiEvaluationResult = evaluation.success ? response.data : null;
  projectDoc.aiEvaluationError = evaluation.success ? null : toStoredAiError(evaluation.error);
  projectDoc.aiEvaluatedAt = new Date();
  projectDoc.aiEvaluatedBy = options.currentUser?.id || null;
  await projectDoc.save();

  return response;
}

export async function getStoredProjectAiEvaluation(projectIdentifier, currentUser) {
  const projectDoc = await Project.findOne(resolveId(projectIdentifier))
    .select("publicId slug name productOwnerId aiEvaluationStatus aiEvaluationResult aiEvaluationError aiEvaluatedAt aiEvaluatedBy")
    .lean();

  if (!projectDoc) {
    throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND", "Check the project id, public id, or slug.");
  }

  if (!canEvaluateProject(projectDoc, currentUser)) {
    throw new AppError(
      "You are not allowed to view AI insights for this project",
      403,
      "PROJECT_AI_EVALUATION_FORBIDDEN",
      "Only an admin or the project supervisor can view AI insights.",
    );
  }

  return {
    status: "Success",
    code: 200,
    message: "Project AI evaluation retrieved successfully!",
    data: {
      project: {
        id: projectDoc.publicId,
        slug: projectDoc.slug,
        name: projectDoc.name,
      },
      aiEvaluationStatus: projectDoc.aiEvaluationStatus || "Pending",
      aiEvaluationResult: projectDoc.aiEvaluationResult || null,
      aiEvaluationError: projectDoc.aiEvaluationError || null,
      aiEvaluatedAt: projectDoc.aiEvaluatedAt || null,
      aiEvaluatedBy: projectDoc.aiEvaluatedBy || null,
    },
  };
}
