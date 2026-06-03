import { internalRoles } from "../internalRoles.js";

const ROLE_ALIASES = new Map();

for (const role of internalRoles) {
  ROLE_ALIASES.set(role.name.toLowerCase(), role.name);
  for (const alias of role.aliases || []) {
    ROLE_ALIASES.set(alias.toLowerCase(), role.name);
  }
}

const SENSITIVE_USER_FIELDS = new Set([
  "password",
  "verificationCode",
  "verificationCodeExpires",
  "resendCount",
  "mustResetPassword",
  "loginAttempts",
  "socialStatus",
  "hasChildren",
  "nbOfChildren",
  "children",
  "isHeadOfFamily",
  "salary",
  "dateOfBirth",
  "idNumber",
  "idType",
  "phoneNumber",
  "address",
  "placeOfBirth",
]);

export function normalizeRoleName(role) {
  if (!role || typeof role !== "string") return "";
  const cleaned = role.trim().replace(/\s+/g, " ");
  const lower = cleaned.toLowerCase();
  return ROLE_ALIASES.get(lower) || cleaned;
}

export function getPronouns(gender) {
  const normalized = (gender || "").toString().trim().toLowerCase();
  if (normalized === "male" || normalized === "man") {
    return { subject: "he", object: "him", possessive: "his", reflexive: "himself" };
  }
  if (normalized === "female" || normalized === "woman") {
    return { subject: "she", object: "her", possessive: "her", reflexive: "herself" };
  }
  return { subject: "they", object: "them", possessive: "their", reflexive: "themself" };
}

export function normalizeProjectForEvaluation(project, deps = {}) {
  if (!project || typeof project !== "object") {
    throw new TypeError("project must be an object");
  }

  const requiredTech = Array.isArray(project.requiredTech) ? project.requiredTech : [];
  const preferredTech = Array.isArray(project.preferredTech) ? project.preferredTech : [];
  const rolesNeeded = Array.isArray(project.rolesNeeded)
    ? project.rolesNeeded.map(normalizeRoleName).filter(Boolean)
    : [];

  const normalizeSkillList = (skills) => {
    if (Array.isArray(skills) && deps.normalizeSkills) return deps.normalizeSkills(skills);
    if (deps.tokenizeSkills) return deps.tokenizeSkills(skills);
    if (deps.normalizeSkills) return deps.normalizeSkills(skills);
    return Array.isArray(skills) ? skills : [skills].filter(Boolean);
  };

  return {
    id: String(project._id || project.id || project.publicId || project.slug || "project"),
    name: String(project.name || "Project"),
    sector: String(project.sector || project.domain || ""),
    description: String(project.description || ""),
    requiredTech: normalizeSkillList(requiredTech),
    preferredTech: normalizeSkillList(preferredTech),
    rolesNeeded: [...new Set(rolesNeeded)],
    status: project.status || "",
    raw: project,
  };
}

export function normalizeUserForEvaluation(user, index = 0) {
  if (!user || typeof user !== "object") {
    throw new TypeError(`User at index ${index} must be an object`);
  }

  const id = String(user._id || user.id || user.publicId || `user_${index + 1}`);
  const firstName = user.name ? String(user.name).trim() : "";
  const lastName = user.lastName ? String(user.lastName).trim() : "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || `User ${index + 1}`;
  const currentPosition = String(user.position || user.employment?.position || user.role || "").trim();
  const gender = user.gender || "";
  const pronouns = getPronouns(gender);
  const isAvailable = user.isAvailable !== false;
  const cvText = String(user.cvText || user.rawCvText || user.resumeText || user.text || user.cv?.text || "").trim();
  const bio = String(user.bio || "").trim();

  const allowedProfileParts = [
    fullName && `Name: ${fullName}`,
    currentPosition && `Current company position: ${currentPosition}`,
    bio && `Bio: ${bio}`,
    user.department?.name && `Department: ${user.department.name}`,
  ].filter(Boolean);

  const ignoredFields = Object.keys(user).filter((key) => SENSITIVE_USER_FIELDS.has(key));

  return {
    id,
    fullName,
    currentPosition,
    gender,
    pronouns,
    isAvailable,
    cvText,
    profileText: allowedProfileParts.join("\n"),
    scoringText: [allowedProfileParts.join("\n"), cvText].filter(Boolean).join("\n\nCV:\n"),
    ignoredFields,
    raw: user,
  };
}

export function buildProjectRankingInput(projectProfile, userProfiles, options = {}) {
  if (!Array.isArray(userProfiles) || userProfiles.length === 0) {
    throw new TypeError("users must be a non-empty array");
  }

  const cvs = userProfiles.map((user, index) => {
    const text = user.scoringText || user.cvText;
    if (!text || text.trim() === "") {
      throw new TypeError(`User at index ${index} must include CV/profile text for evaluation`);
    }
    return {
      id: user.id,
      name: user.fullName,
      text,
    };
  });

  const roleTitle = projectProfile.rolesNeeded.length > 0
    ? projectProfile.rolesNeeded.join(" / ")
    : projectProfile.name;

  return {
    cvs,
    job: {
      roleTitle,
      rawDescription: projectProfile.description,
      normalizedDescription: projectProfile.description,
      domain: projectProfile.sector,
      requiredSkills: projectProfile.requiredTech,
      preferredSkills: projectProfile.preferredTech,
      seniority: options.seniority || "",
    },
    options: { audit: true, ...(options.pipelineOptions || {}) },
  };
}

export function buildUserProfileIndex(userProfiles) {
  return new Map(userProfiles.map((profile) => [profile.id, profile]));
}
