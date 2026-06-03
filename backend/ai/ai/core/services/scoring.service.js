import { internalRoles } from "../internalRoles.js";
import { getCanonicalSkill } from "../skillDictionary.js";
import { countSkillOccurrences, dampenFrequency, parseYearsOfExperience } from "../scoringEngine.js";
import {
  inflationThresholdConfig,
  semanticScoringConfig,
} from "../../config/scoring.config.js";

export { countSkillOccurrences, dampenFrequency };

// Build backward-compatible roleProfiles object dynamically
export const roleProfiles = {};
for (const role of internalRoles) {
  roleProfiles[role.name] = {
    weights: { weightedSkill: 0.80, embedding: 0.10, project: 0.05, experience: 0.05 },
    skillWeights: role.coreSkills.reduce((acc, skill) => {
      acc[skill] = 10;
      return acc;
    }, {}),
    evidenceSkills: [...role.coreSkills, ...role.optionalSkills],
  };
}

export function clampScore(score) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function normalizeRoleSkillAlias(skill) {
  return getCanonicalSkill(skill);
}

/**
 * Calibrates role scores for a candidate against the 10 internal roles.
 * Synchronous execution for stability and regression test compatibility.
 */
export function calibrateRoleScores(arg1, arg2) {
  let candidateSkills, projectContext, experienceContext, embeddingScore, audit, requiredSkills, rolesNeeded;
  
  if (arg1 && typeof arg1 === "object" && arg2 !== undefined) {
    const candidate = arg1;
    const options = arg2 || {};
    candidateSkills = candidate.technicalSkills || candidate.candidateSkills || [];
    projectContext = candidate.projectContext || "";
    experienceContext = candidate.experienceContext || "";
    embeddingScore = candidate.embeddingScore !== undefined 
      ? candidate.embeddingScore 
      : (candidate._projectSimilarity || 0);
    audit = options.audit || candidate.audit || false;
    requiredSkills = candidate.requiredSkills || options.requiredSkills || [];
    rolesNeeded = candidate.rolesNeeded || options.rolesNeeded || [];
  } else {
    const params = arg1 || {};
    candidateSkills = params.technicalSkills || params.candidateSkills || [];
    projectContext = params.projectContext || "";
    experienceContext = params.experienceContext || "";
    embeddingScore = params.embeddingScore !== undefined 
      ? params.embeddingScore 
      : (params._projectSimilarity || 0);
    audit = params.audit || false;
    requiredSkills = params.requiredSkills || [];
    rolesNeeded = params.rolesNeeded || [];
  }

  // Restrict to project's requested roles if provided
  const rolesToScore = rolesNeeded.length > 0 
    ? internalRoles.filter(r => rolesNeeded.includes(r.name))
    : internalRoles;
  if (rolesToScore.length === 0) {
    rolesToScore.push(...internalRoles);
  }

  // Canonical normalization
  const normalized = (candidateSkills || []).map(s => getCanonicalSkill(s));
  const normalizedRequired = (requiredSkills || []).map(s => getCanonicalSkill(s)).filter(Boolean);

  const combinedCtx = `${projectContext || ""} ${experienceContext || ""}`;
  const allWords = combinedCtx.split(/\s+/).filter(w => w.length > 2);
  const totalWords = allWords.length;
  const uniqueWords = new Set(allWords.map(w => w.toLowerCase())).size;
  // Repetition ratio: if < 35% of words are unique, it's a keyword dump (spammer pattern)
  const repetitionRatio = totalWords > 0 ? uniqueWords / totalWords : 1;
  // Anti-Spam: catch both density spam (few words, many skills) and repetition spam
  const isKeywordSpam = normalized.length > inflationThresholdConfig.keywordSpamMinimumSkills && (
    totalWords < normalized.length * 2 ||   // Original: thin context relative to skills
    repetitionRatio < inflationThresholdConfig.keywordSpamMinimumUniqueRatio
  );

  const roleScoreBreakdown = {};
  const auditLogs = {};

  for (const role of rolesToScore) {
    // Dynamically filter the archetype to ONLY score skills requested by the project
    let effectiveCore = role.coreSkills;
    let effectiveOptional = role.optionalSkills;
    
    if (normalizedRequired.length > 0) {
      effectiveCore = role.coreSkills.filter(s => normalizedRequired.includes(s));
      effectiveOptional = role.optionalSkills.filter(s => normalizedRequired.includes(s));
    }

    // 1. Core and Optional Skill matches
    const matchedCore = normalized.filter(s => effectiveCore.includes(s));
    const matchedOptional = normalized.filter(s => effectiveOptional.includes(s));
    const matchedExcluded = normalized.filter(s => role.excludedSkills.includes(s));

    let coreRate = 0;
    if (effectiveCore.length > 0) {
      const required = Math.min(5, effectiveCore.length);
      coreRate = Math.min(1.0, matchedCore.length / required);
      if (matchedCore.length > required) {
        coreRate += (matchedCore.length - required) * 0.05;
      }
    }

    let optionalRate = 0;
    if (effectiveOptional.length > 0) {
      const required = Math.min(3, effectiveOptional.length);
      optionalRate = Math.min(1.0, matchedOptional.length / required);
      if (matchedOptional.length > required) {
        optionalRate += (matchedOptional.length - required) * 0.02;
      }
    }

    const baseSkillScore = (coreRate * 0.7 + optionalRate * 0.3) * 100;

    // Excluded skills soft penalty (deduct 10 points per matched excluded skill)
    const softPenaltyPoints = matchedExcluded.length * 10;
    const skillOverlapScore = Math.max(0, Math.min(100, baseSkillScore - softPenaltyPoints));

    // 2. Project/CV Evidence (5% in symbolic)
    let evidenceHits = 0;
    const combinedCtxForEvidence = `${projectContext || ""} ${experienceContext || ""}`;
    const allSearchSkills = [...effectiveCore, ...effectiveOptional];
    for (const skill of allSearchSkills) {
      evidenceHits += countSkillOccurrences(combinedCtxForEvidence, skill);
    }
    const evidenceScore = Math.min(100, dampenFrequency(evidenceHits) * 20);

    // 3. Keyword / Taxonomy (5% in symbolic)
    let taxonomyHits = 0;
    const matchTargets = [role.name, ...(role.aliases || [])].filter(Boolean);
    const foundTarget = matchTargets.some(target => {
      if (combinedCtxForEvidence.toLowerCase().includes(target.toLowerCase())) {
        taxonomyHits += countSkillOccurrences(combinedCtxForEvidence, target);
        return true;
      }
      return false;
    });
    const taxonomyScore = foundTarget ? Math.min(100, 60 + dampenFrequency(taxonomyHits) * 10) : 0;

    // COMBINED BASE SYMBOLIC SCORE (Out of 80 max)
    const baseSymbolicScore = (skillOverlapScore * 0.70) + (evidenceScore * 0.05) + (taxonomyScore * 0.05);

    // Years of Experience Heuristic & Seniority Constraints
    const contextLower = combinedCtxForEvidence.toLowerCase();
    const hasSeniorKeywords = /\b(senior|lead|principal|architect)\b/i.test(contextLower);
    const parsedYoe = parseYearsOfExperience(contextLower);
    
    const isSeniorCandidate = hasSeniorKeywords || parsedYoe >= 5;
    let experienceAdjustment = 0;
    if (parsedYoe > 0) {
      experienceAdjustment += Math.min(5, parsedYoe * 0.5);
    }
    if (isSeniorCandidate) {
      experienceAdjustment += 2;
    } else if (parsedYoe > 0 && parsedYoe < 2 && !hasSeniorKeywords) {
      experienceAdjustment -= 3;
    }

    let symbolicScore = baseSymbolicScore + experienceAdjustment;
    symbolicScore = Math.max(0, Math.min(80, symbolicScore));

    // Constraints & Suppression Penalties
    let penaltyApplied = "None";

    // Hard Zero-Skill Overlap Penalty
    if (matchedCore.length === 0 && matchedOptional.length === 0) {
      symbolicScore = Math.round(symbolicScore * 0.05);
      penaltyApplied = "Zero-Skill Suppression";
    }

    // No-Frontend-Skills Suppression
    if (["Frontend Developer", "Fullstack Developer"].includes(role.name)) {
      const hasFE = normalized.some(s => 
        ["reactjs", "vuejs", "angular", "nextjs", "tailwindcss", "html", "css"].includes(s)
      );
      if (!hasFE) {
        symbolicScore = Math.round(symbolicScore * 0.10);
        penaltyApplied = penaltyApplied === "None" ? "No-Frontend-Skills Suppression" : `${penaltyApplied}, No-Frontend-Skills Suppression`;
      }
    }

    // Keyword Spam Defense
    if (isKeywordSpam) {
      symbolicScore = Math.round(symbolicScore * 0.20);
      penaltyApplied = penaltyApplied === "None" ? "Keyword Spam Penalty" : `${penaltyApplied}, Keyword Spam Penalty`;
    }

    if (matchedExcluded.length > 0) {
      penaltyApplied = penaltyApplied === "None"
        ? `Soft Excluded Skill Penalty (-${softPenaltyPoints} pts)`
        : `${penaltyApplied}, Soft Excluded Skill Penalty (-${softPenaltyPoints} pts)`;
    }

    // CONTROLLED FUSION LAYER (symbolicScore max 80, semantic max 20)
    const semanticScore = embeddingScore; // Now [0, 1]
    const semanticComponent = Math.max(0, Math.min(semanticScoringConfig.maxSemanticComponent, semanticScore * semanticScoringConfig.maxSemanticComponent));
    let finalScore = Math.round(symbolicScore + semanticComponent);
    finalScore = Math.max(0, Math.min(100, finalScore));

    roleScoreBreakdown[role.name] = {
      weightedSkillScore: clampScore(skillOverlapScore),
      embeddingContribution: semanticComponent,
      projectContribution: clampScore(evidenceScore * 0.6),
      experienceContribution: clampScore(evidenceScore * 0.4),
      symbolicScore,
      semanticScore,
      semanticComponent,
      totalRoleScore: finalScore,
    };

    if (audit) {
      auditLogs[role.name] = {
        symbolicScore,
        semanticScore,
        finalScore,
        factorWeights: { weightedSkill: 0.70, embedding: 0.20, project: 0.05, experience: 0.05 },
        skillContribution: {
          presentWeightSum: matchedCore.length + matchedOptional.length,
          totalPossible: effectiveCore.length + effectiveOptional.length,
          scoreBeforeWeight: skillOverlapScore,
          contribution: skillOverlapScore * 0.70,
        },
        embeddingContribution: {
          raw: embeddingScore,
          cap: semanticScoringConfig.maxSemanticComponent,
          scoreBeforeWeight: embeddingScore,
          contribution: semanticComponent,
        },
        projectContribution: {
          sum: evidenceHits,
          scoreBeforeWeight: evidenceScore,
          contribution: evidenceScore * 0.05,
        },
        experienceContribution: {
          sum: taxonomyHits,
          scoreBeforeWeight: taxonomyScore,
          contribution: taxonomyScore * 0.05,
        },
        experienceHeuristic: {
          parsedYoe,
          isSeniorCandidate,
          experienceAdjustment
        },
        beforeScore: baseSymbolicScore,
        afterScore: finalScore,
        penaltyApplied
      };
    }
  }

  // Sort by score
  const roleDistribution = rolesToScore
    .map((role) => ({ 
      role: role.name, 
      score: roleScoreBreakdown[role.name].totalRoleScore,
      symbolicScore: roleScoreBreakdown[role.name].symbolicScore
    }))
    .sort((a, b) => {
      const diff = b.score - a.score;
      if (Math.abs(diff) > 0.01) {
        return diff;
      }
      // If final scores are functionally equal, use deterministic tie-breakers:
      // 1. symbolicScore
      if (b.symbolicScore !== a.symbolicScore) {
        return b.symbolicScore - a.symbolicScore;
      }
      // 2. skill overlap count
      const roleA = rolesToScore.find(r => r.name === a.role);
      const roleB = rolesToScore.find(r => r.name === b.role);
      
      let effectiveCoreA = roleA.coreSkills;
      let effectiveOptA = roleA.optionalSkills;
      let effectiveCoreB = roleB.coreSkills;
      let effectiveOptB = roleB.optionalSkills;
      
      if (normalizedRequired.length > 0) {
        effectiveCoreA = roleA.coreSkills.filter(s => normalizedRequired.includes(s));
        effectiveOptA = roleA.optionalSkills.filter(s => normalizedRequired.includes(s));
        effectiveCoreB = roleB.coreSkills.filter(s => normalizedRequired.includes(s));
        effectiveOptB = roleB.optionalSkills.filter(s => normalizedRequired.includes(s));
      }

      const overlapA = normalized.filter(s => effectiveCoreA.includes(s)).length + normalized.filter(s => effectiveOptA.includes(s)).length;
      const overlapB = normalized.filter(s => effectiveCoreB.includes(s)).length + normalized.filter(s => effectiveOptB.includes(s)).length;
      if (overlapB !== overlapA) {
        return overlapB - overlapA;
      }
      // 3. stable alphabetical comparison
      return a.role.localeCompare(b.role);
    });

  const primary = roleDistribution[0]?.role || "Fullstack Developer";
  const secondary =
    roleDistribution.length > 1 &&
    roleDistribution[0].score - roleDistribution[1].score < 10
      ? roleDistribution[1].role
      : null;

  const confidence = clampScore(
    (roleDistribution[0]?.score || 0) * 0.6 +
    (embeddingScore || 0) * 0.2 +
    (roleDistribution[1]?.score || 0) * 0.2
  );

  const winningRole = roleDistribution[0]?.role || "";
  const runnerUpRole = roleDistribution[1]?.role || "";
  const winningScore = roleDistribution[0]?.score || 0;
  const runnerUpScore = roleDistribution[1]?.score || 0;
  const margin = winningScore - runnerUpScore;

  const whyWinnerWon = [];
  const whyOthersLost = [];

  if (winningRole) {
    const winnerProfile = rolesToScore.find(r => r.name === winningRole);
    let effectiveWinnerCore = winnerProfile.coreSkills;
    if (normalizedRequired.length > 0) {
      effectiveWinnerCore = winnerProfile.coreSkills.filter(s => normalizedRequired.includes(s));
    }
    const winnerMatchedCore = normalized.filter(s => effectiveWinnerCore.includes(s));
    whyWinnerWon.push(`'${winningRole}' has a dominant score of ${winningScore} points.`);
    if (winnerMatchedCore.length > 0) {
      whyWinnerWon.push(`Matched critical skill weights in ${winningRole}: ${winnerMatchedCore.slice(0, 3).join(", ")}.`);
    }
  }

  rolesToScore.forEach(role => {
    if (role.name !== winningRole) {
      let effectiveCore = role.coreSkills;
      if (normalizedRequired.length > 0) {
        effectiveCore = role.coreSkills.filter(s => normalizedRequired.includes(s));
      }
      const missingSkills = effectiveCore.filter(s => !normalized.includes(s));
      const deficit = winningScore - roleScoreBreakdown[role.name].totalRoleScore;
      let reason = `'${role.name}' lost to '${winningRole}' by a margin of ${deficit} points.`;
      if (missingSkills.length > 0) {
        reason += ` Lacks skills: ${missingSkills.slice(0, 3).join(", ")}.`;
      }
      whyOthersLost.push(reason);
    }
  });

  const decisionDelta = {
    winningRole,
    runnerUpRole,
    margin,
    whyWinnerWon,
    whyOthersLost,
  };

  if (audit) {
    rolesToScore.forEach(role => {
      if (auditLogs[role.name]) {
        auditLogs[role.name].decisionDelta = decisionDelta;
      }
    });
  }

  const result = {
    primary,
    secondary,
    confidence,
    roleDistribution,
    roleScoreBreakdown,
    decisionDelta,
  };

  if (audit) {
    result.audit = auditLogs;
  }

  return result;
}
