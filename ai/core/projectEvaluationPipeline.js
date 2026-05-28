import { runRankingPipeline } from "./pipeline.js";
import {
  buildProjectRankingInput,
  buildUserProfileIndex,
  normalizeProjectForEvaluation,
  normalizeUserForEvaluation,
} from "./services/project-profile.service.js";
import {
  buildCandidateDecision,
  buildRoleAssignmentExplanation,
  selectProjectRole,
  resolveRoleAlias,
} from "./services/decision.service.js";
import { internalRoles } from "./internalRoles.js";

function assertProjectEvaluationInput(input) {
  if (!input || typeof input !== "object") {
    throw new TypeError("input must be an object");
  }
  if (!input.project || typeof input.project !== "object") {
    throw new TypeError("project must be provided");
  }
  if (!Array.isArray(input.users) || input.users.length === 0) {
    throw new TypeError("users must be a non-empty array");
  }
}

function roleScoreFor(candidate, roleName) {
  const canonical = resolveRoleAlias(roleName);
  return (candidate.roleDistribution || []).find((item) => item.role === canonical)?.score ?? null;
}

// assignmentConfidence removed to consolidate confidence scores with individual cards

function compareCandidatesForRole(role) {
  return (a, b) => {
    const roleScoreDiff = (b.roleScores?.[role] ?? -1) - (a.roleScores?.[role] ?? -1);
    if (roleScoreDiff !== 0) return roleScoreDiff;
    if (b.compatibilityScore !== a.compatibilityScore) return b.compatibilityScore - a.compatibilityScore;
    if (b.matchedTech.length !== a.matchedTech.length) return b.matchedTech.length - a.matchedTech.length;
    return a.fullName.localeCompare(b.fullName);
  };
}

function buildClosestCandidateGap(candidate, role, projectProfile) {
  const name = (candidate.fullName || "This candidate").split(" ")[0];
  const missing = (candidate.missingTech || []).slice(0, 3);
  const projectName = projectProfile.name || "this project";

  if (missing.length > 0) {
    const gapList = missing.join(" and ");
    return {
      candidateId: candidate.userId,
      candidateName: candidate.fullName,
      gapExplanation: `${name} could grow into this role with hands-on experience in ${gapList} — consider for ${projectName} with a targeted development plan.`,
    };
  }

  return {
    candidateId: candidate.userId,
    candidateName: candidate.fullName,
    gapExplanation: `${name} is the closest available candidate for the ${role} role — validate fit with a targeted skills assessment before committing.`,
  };
}

function buildRoleAssignments(ranking, allCandidates, projectProfile) {
  const roles = projectProfile.rolesNeeded.length > 0
    ? projectProfile.rolesNeeded
    : [...new Set(ranking.map((candidate) => candidate.selectedRole).filter(Boolean))];
  const assignedUserIds = new Set();
  const assignments = [];
  const warnings = [];

  for (const role of roles) {
    // Primary: find candidate whose best-fit role matches (resolved aliases)
    const canonicalRole = resolveRoleAlias(role);
    let candidate = ranking
      .filter((item) => item.isAvailable !== false && !assignedUserIds.has(item.userId) && resolveRoleAlias(item.selectedRole) === canonicalRole)
      .sort(compareCandidatesForRole(role))[0];

    // Fallback: any unassigned available candidate that has a role score for this role
    if (!candidate) {
      candidate = ranking
        .filter((item) => item.isAvailable !== false && !assignedUserIds.has(item.userId) && (item.roleScores?.[role] ?? -1) >= 0)
        .sort(compareCandidatesForRole(role))[0];
    }

    // Find the closest candidate from ALL candidates for a best-effort suggestion
    const closestInPool = allCandidates
      .filter((item) => !assignedUserIds.has(item.userId))
      .sort((a, b) => {
        const aScore = a.roleScores?.[role] ?? a.compatibilityScore ?? 0;
        const bScore = b.roleScores?.[role] ?? b.compatibilityScore ?? 0;
        return bScore - aScore;
      })[0];

    if (!candidate) {
      const closestCandidate = closestInPool
        ? buildClosestCandidateGap(closestInPool, role, projectProfile)
        : null;
      assignments.push({
        role,
        candidateId: null,
        candidateName: "No suitable candidate found",
        confidence: 0,
        explanation: `No eligible candidate was available in the pool for the ${role} role.`,
        closestCandidate,
      });
      warnings.push(`No eligible candidate was available for the ${role} role.`);
      continue;
    }

    // Minimum credibility threshold for assignment
    const roleScore = candidate.roleScores?.[role] ?? 0;
    const isCredibleFit = roleScore >= 15 || candidate.compatibilityScore >= 35 || candidate.matchedTech.length >= 2;

    if (!isCredibleFit) {
      const closestCandidate = closestInPool
        ? buildClosestCandidateGap(closestInPool, role, projectProfile)
        : null;
      assignments.push({
        role,
        candidateId: null,
        candidateName: "No suitable candidate found",
        confidence: 0,
        explanation: `No candidate in the pool is a credible fit for the ${role} role based on the required technologies and experience.`,
        closestCandidate,
      });
      warnings.push(`No suitable candidate found for the ${role} role.`);
      continue;
    }

    assignedUserIds.add(candidate.userId);
    const confidence = candidate.compatibilityScore;
    assignments.push({
      role,
      candidateId: candidate.userId,
      candidateName: candidate.fullName,
      confidence,
      explanation: buildRoleAssignmentExplanation({
        role,
        candidate,
        projectProfile,
      }),
      closestCandidate: null,
    });
  }

  return { assignments, warnings };
}

function toFrontendCandidate(candidate) {
  const {
    roleScores,
    ...safeCandidate
  } = candidate;

  return {
    ...safeCandidate,
    candidateId: candidate.userId,
    candidateName: candidate.fullName,
    recommendedRole: candidate.selectedRole,
    confidence: candidate.compatibilityScore,
    matchedSkills: candidate.matchedTech,
    missingSkills: candidate.missingTech,
    risks: candidate.weaknesses,
    explanation: candidate.decisionReason,
  };
}

export async function runProjectEvaluationPipeline(input, deps) {
  assertProjectEvaluationInput(input);

  const projectProfile = normalizeProjectForEvaluation(input.project, deps);
  const userProfiles = input.users.map((user, index) => normalizeUserForEvaluation(user, index));
  const userProfileIndex = buildUserProfileIndex(userProfiles);
  const pipelineInput = buildProjectRankingInput(projectProfile, userProfiles, input.options || {});

  const result = await runRankingPipeline(pipelineInput, deps);

  const ranking = result.ranking
    .filter((candidate) => candidate.isValid !== false && !candidate.invalidReason)
    .map((candidate) => {
      const userProfile = userProfileIndex.get(candidate.id);
      const roleSelection = selectProjectRole(candidate, projectProfile.rolesNeeded);
      const decision = buildCandidateDecision({
        candidate,
        userProfile,
        projectProfile,
        ...roleSelection,
      });

      return {
        userId: candidate.id,
        fullName: userProfile?.fullName || candidate.name,
        currentPosition: userProfile?.currentPosition || "",
        isAvailable: userProfile?.isAvailable,
        selectedRole: roleSelection.selectedRole,
        roleScores: Object.fromEntries(
          (projectProfile.rolesNeeded || [])
            .map((role) => [role, roleScoreFor(candidate, role)])
            .filter(([, score]) => score !== null)
        ),
        compatibilityScore: decision.compatibilityScore,
        projectMatchScore: candidate.projectMatchScore,
        matchedTech: candidate.matchedSkills || [],
        missingTech: candidate.missingSkills || [],
        strengths: decision.strengths,
        weaknesses: decision.weaknesses,
        finalDecision: decision.finalDecision,
        decisionReason: decision.decisionReason,
        roleJustification: decision.roleJustification,
        projectCompatibility: decision.projectCompatibility,
        domainCompatibility: candidate.domainCompatibility,
        seniorityMatch: candidate.seniorityMatch,
        ignoredProfileFields: userProfile?.ignoredFields || [],
        reasons: candidate.reasons || [],
      };
    })
    .sort((a, b) => {
      if (b.compatibilityScore !== a.compatibilityScore) {
        return b.compatibilityScore - a.compatibilityScore;
      }
      if (b.matchedTech.length !== a.matchedTech.length) {
        return b.matchedTech.length - a.matchedTech.length;
      }
      return a.fullName.localeCompare(b.fullName);
    })
    .map((candidate, index) => ({
      ...candidate,
      rank: index + 1,
    }));

  const { assignments: roleAssignments, warnings } = buildRoleAssignments(ranking, ranking, projectProfile);
  const rankedCandidates = ranking.map(toFrontendCandidate);
  const assignmentSummary = roleAssignments.length > 0
    ? roleAssignments.map((item) => `${item.role} → ${item.candidateName}`).join("; ")
    : "No role assignment could be generated from the eligible candidate pool.";

  // Build a strategic summary: assess team readiness, strongest coverage, biggest gap
  function buildAiSummaryOverview() {
    const validAssignments = roleAssignments.filter(a => a.candidateId);
    if (validAssignments.length === 0) {
      return `No recommended team composition could be generated for ${projectProfile.name} — no eligible candidates matched the required roles.`;
    }

    const rolesNeeded = projectProfile.rolesNeeded || [];
    const coveredRoles = validAssignments.map((a) => a.role);
    const uncoveredRoles = rolesNeeded.filter((r) => !coveredRoles.includes(r));

    // Find the best-matched candidate for context
    const topAssignment = validAssignments[0];
    const topCandidate = ranking.find((c) => c.userId === topAssignment?.candidateId);
    const topMatchedTech = topCandidate?.matchedTech || [];
    const topMissingTech = topCandidate?.missingTech || [];

    // Find the role with the lowest average compatibility score as the "biggest gap"
    const weakestRole = validAssignments
      .map((a) => ({
        role: a.role,
        candidate: ranking.find((c) => c.userId === a.candidateId),
      }))
      .filter((x) => x.candidate)
      .sort((a, b) => (a.candidate.compatibilityScore || 0) - (b.candidate.compatibilityScore || 0))[0];

    const strongestRole = validAssignments
      .map((a) => ({
        role: a.role,
        candidate: ranking.find((c) => c.userId === a.candidateId),
      }))
      .filter((x) => x.candidate)
      .sort((a, b) => (b.candidate.compatibilityScore || 0) - (a.candidate.compatibilityScore || 0))[0];

    const parts = [];

    // Opening: overall team readiness verdict
    if (uncoveredRoles.length > 0) {
      parts.push(`${projectProfile.name} has partial role coverage — ${uncoveredRoles.join(", ")} could not be filled from the current candidate pool.`);
    } else if (rolesNeeded.length > 0) {
      parts.push(`${projectProfile.name} has full role coverage across all ${rolesNeeded.length} required position${rolesNeeded.length === 1 ? "" : "s"}.`);
    } else {
      parts.push(`Team composition for ${projectProfile.name} has been assessed across the available candidate pool.`);
    }

    // Strength highlight
    if (strongestRole && topMatchedTech.length > 0) {
      const techHighlight = topMatchedTech.slice(0, 3).join(", ");
      parts.push(`Strongest coverage is in ${strongestRole.role} — the assigned candidate brings solid ${techHighlight} experience aligned with the project's core stack.`);
    } else if (strongestRole) {
      parts.push(`Strongest coverage is in ${strongestRole.role}, where the assigned candidate best matches the project's technical requirements.`);
    }

    // Gap highlight
    if (weakestRole && weakestRole.role !== strongestRole?.role) {
      const missingInWeak = weakestRole.candidate?.missingTech?.slice(0, 2) || [];
      if (missingInWeak.length > 0) {
        parts.push(`The main gap is in ${weakestRole.role} — the assigned candidate will likely need support on ${missingInWeak.join(" and ")} before operating fully independently.`);
      } else {
        parts.push(`The ${weakestRole.role} assignment is the least certain — the supervisor should validate the fit before finalising.`);
      }
    }

    return parts.slice(0, 3).join(" ");
  }

  const aiSummary = {
    title: "Recommended Team Composition",
    overview: buildAiSummaryOverview(),
    recommendations: roleAssignments.map((item) => ({
      role: item.role,
      candidateId: item.candidateId,
      candidateName: item.candidateName,
      confidence: item.confidence,
      explanation: item.explanation,
    })),
  };

  return {
    project: {
      id: projectProfile.id,
      name: projectProfile.name,
      sector: projectProfile.sector,
      requiredTech: projectProfile.requiredTech,
      preferredTech: projectProfile.preferredTech,
      rolesNeeded: projectProfile.rolesNeeded,
    },
    rankedCandidates,
    roleAssignments,
    excludedCandidates: [],
    warnings,
    aiSummary,
    ranking: rankedCandidates,
    summary: {
      totalUsers: rankedCandidates.length,
      assignedRoles: roleAssignments.length,
      topUser: roleAssignments[0]?.candidateName || rankedCandidates[0]?.fullName || null,
      topRole: roleAssignments[0]?.role || rankedCandidates[0]?.selectedRole || null,
    },
    fingerprints: result.fingerprints,
  };
}
