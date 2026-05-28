import { cosineSimilarity } from "./embeddingService.js";
import { normalizeText } from "./normalizer.js";
import {
  inflationThresholdConfig,
  semanticScoringConfig,
} from "../config/scoring.config.js";

const warnPipeline = (...args) => {
  if (process.env.DEBUG_PIPELINE === "true") console.warn(...args);
};

/**
 * Dampens a frequency count logarithmically.
 * @param {number} count - The raw count of occurrences.
 * @returns {number} The dampened score.
 */
export function dampenFrequency(count) {
  if (count <= 0) return 0;
  return 1 + Math.log1p(count - 1);
}

/**
 * Counts the exact occurrences of a skill label within a text body.
 * Avoids partial matching using word boundaries.
 * @param {string} text - The text context to search.
 * @param {string} skill - The skill label to search.
 * @returns {number} Number of occurrences.
 */
export function countSkillOccurrences(text, skill) {
  if (!text || !skill) return 0;
  const escaped = skill.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(?:^|[^a-zA-Z0-9+#.])(${escaped})(?:$|[^a-zA-Z0-9+#.])`, "gi");
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

/**
 * Calculates the hybrid score between a Candidate and an Internal Role.
 * 
 * @param {object} candidate - Candidate object containing technicalSkills, projectContext, experienceContext, etc.
 * @param {object} role - Internal Role object containing name, aliases, coreSkills, optionalSkills, excludedSkills, description
 * @param {object} deps - Injected embedding and semantic similarity functions.
 * @param {boolean} [audit=false] - If true, returns a detailed breakdown of scoring components.
 * @returns {object} Final score (0-100) and optional breakdown.
 */
/**
 * Parses years of experience from a text body using robust regex rules.
 * @param {string} text - The text context to parse.
 * @returns {number} Max years of experience found.
 */
export function parseYearsOfExperience(text) {
  if (!text || typeof text !== "string") return 0;
  const numberMap = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15
  };
  const regex = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen)\+?\s*(?:years?|yrs?)\b/gi;
  let match;
  let maxYears = 0;
  while ((match = regex.exec(text)) !== null) {
    const val = match[1].toLowerCase();
    const years = numberMap[val] !== undefined ? numberMap[val] : parseInt(val, 10);
    if (!isNaN(years) && years > maxYears) {
      maxYears = years;
    }
  }
  return maxYears;
}

/**
 * Calculates the hybrid score between a Candidate and an Internal Role.
 * 
 * @param {object} candidate - Candidate object containing technicalSkills, projectContext, experienceContext, etc.
 * @param {object} role - Internal Role object containing name, aliases, coreSkills, optionalSkills, excludedSkills, description
 * @param {object} deps - Injected embedding and semantic similarity functions.
 * @param {boolean} [audit=false] - If true, returns a detailed breakdown of scoring components.
 * @returns {object} Final score (0-100) and optional breakdown.
 */
export async function calculateHybridScore(candidate, role, deps, audit = false) {
  const { getEmbedding } = deps;

  // 1. EMBEDDING SIMILARITY (SEMANTIC SCORE)
  const candContext = `${candidate.projectContext || ""} ${candidate.experienceContext || ""}`.trim();
  const roleContext = `${role.name || ""} ${role.description || ""}`.trim();

  let embeddingSimilarity = 0;
  if (candContext && roleContext) {
    try {
      const candEmbed = await getEmbedding(candContext);
      const roleEmbed = await getEmbedding(roleContext);
      const sim = cosineSimilarity(candEmbed.vector !== undefined ? candEmbed.vector : candEmbed, roleEmbed.vector !== undefined ? roleEmbed.vector : roleEmbed);
      embeddingSimilarity = Math.max(0, sim);
    } catch (err) {
      warnPipeline(`[SEMANTIC FALLBACK] Hybrid role embedding failed; assigning deterministic zero similarity. ${err.message}`);
      embeddingSimilarity = 0.0;
    }
  }
  const semanticScore = embeddingSimilarity;

  // 2. DETAILED SYMBOLIC SCORE
  const candidateSkills = candidate.technicalSkills || [];
  const coreSkills = role.coreSkills || [];
  const optionalSkills = role.optionalSkills || [];
  const excludedSkills = role.excludedSkills || [];

  const matchedCore = candidateSkills.filter(s => coreSkills.includes(s));
  const matchedOptional = candidateSkills.filter(s => optionalSkills.includes(s));
  const matchedExcluded = candidateSkills.filter(s => excludedSkills.includes(s));

  // Core match rate: matching 5 core skills gives 100% of core score (cap at 5 for breadth differentiation)
  const coreRate = coreSkills.length > 0 
    ? Math.min(1.0, matchedCore.length / Math.min(5, coreSkills.length)) 
    : 0;

  // Optional match rate: matching 3 optional skills gives 100% of optional score
  const optionalRate = optionalSkills.length > 0 
    ? Math.min(1.0, matchedOptional.length / Math.min(3, optionalSkills.length)) 
    : 0;

  const baseSkillScore = (coreRate * 0.7 + optionalRate * 0.3) * 100;

  // Soft Penalty for Excluded Skills: deduct 10 points per matched excluded skill (never hard suppress)
  const softPenaltyPoints = matchedExcluded.length * 10;
  const skillOverlapScore = Math.max(0, Math.min(100, baseSkillScore - softPenaltyPoints));

  // Project/CV Evidence (5%)
  let evidenceScore = 0;
  let evidenceHits = 0;
  if (candidate.projectContext || candidate.experienceContext) {
    const combinedCtx = `${candidate.projectContext || ""} ${candidate.experienceContext || ""}`;
    const allSearchSkills = [...coreSkills, ...optionalSkills];
    for (const skill of allSearchSkills) {
      evidenceHits += countSkillOccurrences(combinedCtx, skill);
    }
    evidenceScore = Math.min(100, dampenFrequency(evidenceHits) * 20);
  }

  // Keyword/Taxonomy Signals (5%)
  let taxonomyScore = 0;
  let taxonomyHits = 0;
  const normalizedCandidateText = normalizeText(candContext);
  
  // Check if role name or aliases appear in candidate text
  const matchTargets = [role.name, ...(role.aliases || [])].filter(Boolean);
  const foundTarget = matchTargets.some(target => {
    const normTarget = normalizeText(target);
    if (normTarget && normalizedCandidateText.includes(normTarget)) {
      taxonomyHits += countSkillOccurrences(candContext, target);
      return true;
    }
    return false;
  });

  if (foundTarget) {
    taxonomyScore = 60 + Math.min(40, dampenFrequency(taxonomyHits) * 10);
  }
  taxonomyScore = Math.min(100, taxonomyScore);

  // COMBINED BASE SYMBOLIC SCORE (Out of 80 max)
  // skill overlap = 70 pts max, evidence = 5 pts max, taxonomy = 5 pts max
  const baseSymbolicScore = (skillOverlapScore * 0.70) + (evidenceScore * 0.05) + (taxonomyScore * 0.05);

  // Years of Experience Heuristic & Seniority Constraints
  const contextLower = `${candidate.projectContext || ""} ${candidate.experienceContext || ""} ${candidate.rawText || ""}`.toLowerCase();
  const hasSeniorKeywords = /\b(senior|lead|principal|architect)\b/i.test(contextLower);
  const parsedYoe = parseYearsOfExperience(contextLower);
  
  const isSeniorCandidate = hasSeniorKeywords || parsedYoe >= 5;
  let experienceAdjustment = 0;
  if (isSeniorCandidate) {
    experienceAdjustment = 3; // +3 points for senior experience profile
  } else if (parsedYoe > 0 && parsedYoe < 2 && !hasSeniorKeywords) {
    experienceAdjustment = -3; // -3 points penalty for junior profile
  }

  let symbolicScore = baseSymbolicScore + experienceAdjustment;
  symbolicScore = Math.max(0, Math.min(80, symbolicScore));

  // Anti-Spam: catch keyword dump (spammer pattern)
  const combinedCtxWords = candContext.split(/\s+/).filter(w => w.length > 2);
  const totalWords = combinedCtxWords.length;
  const uniqueWords = new Set(combinedCtxWords.map(w => w.toLowerCase())).size;
  const repetitionRatio = totalWords > 0 ? uniqueWords / totalWords : 1;
  const normalizedCandidateSkills = candidateSkills.map(s => normalizeText(s));
  const isKeywordSpam = normalizedCandidateSkills.length > inflationThresholdConfig.keywordSpamMinimumSkills && (
    totalWords < normalizedCandidateSkills.length * 2 ||
    repetitionRatio < inflationThresholdConfig.keywordSpamMinimumUniqueRatio
  );

  // Rule-based constraints and suppression penalties
  let penaltyApplied = "None";

  // Hard Zero-Skill Overlap Penalty (Slash score to near zero)
  if (matchedCore.length === 0 && matchedOptional.length === 0) {
    symbolicScore = Math.round(symbolicScore * 0.05);
    penaltyApplied = "Zero-Skill Suppression";
  }

  // No-Frontend-Skills Suppression for Frontend/Fullstack roles
  if (["Frontend Developer", "Fullstack Developer"].includes(role.name)) {
    const hasFE = candidateSkills.some(s => 
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

  // 3. CONTROLLED FUSION LAYER (symbolicScore max 80, semantic max 20)
  const semanticComponent = Math.max(0, Math.min(semanticScoringConfig.maxSemanticComponent, semanticScore * semanticScoringConfig.maxSemanticComponent));
  let finalScore = Math.round(symbolicScore + semanticComponent);
  finalScore = Math.max(0, Math.min(100, finalScore));

  const result = {
    score: finalScore,
    primaryRole: role.name,
    roleName: role.name,
    symbolicScore,
    semanticScore,
    semanticComponent
  };

  if (audit) {
    result.matchedCore = matchedCore;
    result.matchedOptional = matchedOptional;
    result.matchedExcluded = matchedExcluded;
    result.penaltyApplied = penaltyApplied;
    result.evidenceHits = evidenceHits;
    result.taxonomyHits = taxonomyHits;
    result.breakdown = {
      symbolicScore: parseFloat(symbolicScore.toFixed(2)),
      semanticScore: parseFloat(semanticScore.toFixed(2)),
      finalScore,
      experienceHeuristic: {
        parsedYoe,
        isSeniorCandidate,
        experienceAdjustment
      },
      embedding: {
        similarity: embeddingSimilarity,
        score: semanticScore,
        contribution: parseFloat(semanticComponent.toFixed(2)),
        weight: 1.0,
        maxSemanticImpact: semanticScoringConfig.maxSemanticComponent
      },
      skillOverlap: {
        score: Math.round(skillOverlapScore),
        contribution: parseFloat((skillOverlapScore * 0.70).toFixed(2)),
        weight: 0.70,
        baseSkillScore,
        softPenaltyPoints
      },
      projectEvidence: {
        score: Math.round(evidenceScore),
        contribution: parseFloat((evidenceScore * 0.05).toFixed(2)),
        weight: 0.05
      },
      taxonomy: {
        score: Math.round(taxonomyScore),
        contribution: parseFloat((taxonomyScore * 0.05).toFixed(2)),
        weight: 0.05
      },
      penaltyApplied
    };
  }

  return result;
}
