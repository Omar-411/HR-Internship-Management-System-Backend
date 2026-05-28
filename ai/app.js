import { runRankingPipeline } from "./core/pipeline.js";
import { runProjectEvaluationPipeline } from "./core/projectEvaluationPipeline.js";
import { getEmbedding, cosineSimilarity } from "./core/services/embedding.service.js";
import { getValidatedCommentary, getChatCompletion } from "./core/services/llm.service.js";
import { validateCandidateSchema } from "./validation/schema.js";
import { normalizeSkills, normalizeDomains, buildContextText, tokenizeSkills } from "./normalization/skills.js";
import { deepCopy, deepFreeze, stableCandidateFingerprint } from "./normalization/fingerprint.js";
import {
  calibrateRoleScores,
  clampScore,
  countSkillOccurrences,
  dampenFrequency,
} from "./core/services/scoring.service.js";

function buildPipelineDeps() {
  return {
    getEmbedding,
    getValidatedCommentary,
    getChatCompletion,
    validateCandidateSchema,
    normalizeSkills,
    tokenizeSkills,
    normalizeDomains,
    buildContextText,
    stableCandidateFingerprint,
    calibrateRoleScores,
    deepFreeze,
    deepCopy,
    cosineSimilarity,
    countSkillOccurrences,
    dampenFrequency,
    clampScore,
  };
}

function normalizeCandidate(candidate, index) {
  if (!candidate || typeof candidate !== "object") {
    throw new TypeError(`Candidate at index ${index} must be an object`);
  }
  const text = candidate.text ?? candidate.rawText ?? candidate.resumeText ?? "";
  if (typeof text !== "string" || text.trim() === "") {
    throw new TypeError(`Candidate at index ${index} must include non-empty text`);
  }
  return {
    id: String(candidate.id ?? `candidate_${index + 1}`),
    name: String(candidate.name ?? `Candidate ${index + 1}`),
    text,
  };
}

function buildPipelineInput({ jobDescription, candidates }) {
  if (typeof jobDescription !== "string" || jobDescription.trim() === "") {
    throw new TypeError("jobDescription must be a non-empty string");
  }
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new TypeError("candidates must be a non-empty array");
  }

  return {
    cvs: candidates.map(normalizeCandidate),
    project: {
      name: "CV Ranking Request",
      description: jobDescription,
      sector: "",
    },
    REQUIRED_TECHNOLOGIES: [],
    PREFERRED_TECHNOLOGIES: [],
    ROLE_TYPES: [],
    options: { audit: false },
  };
}

function toApiCandidate(candidate) {
  return {
    id: candidate.id,
    name: candidate.name,
    score: candidate.score,
    symbolicScore: candidate.symbolicScore,
    semanticScore: candidate.semanticScore,
    semanticComponent: candidate.semanticComponent,
    matchedSkills: candidate.matchedSkills || [],
    missingSkills: candidate.missingSkills || [],
    domainMatch: candidate.projectMatchScore,
    explanation: {
      recommendation: candidate.recommendation,
      reasons: candidate.reasons || [],
      strengths: candidate.strengths || [],
      weaknesses: candidate.weaknesses || [],
      predictedRole: candidate.predictedRole,
      domainCompatibility: candidate.domainCompatibility,
    },
  };
}

function toApiError(error) {
  const validationError = error instanceof TypeError;
  return {
    code: validationError ? "INVALID_INPUT" : "PIPELINE_FAILURE",
    message: validationError ? error.message : "CV ranking pipeline failed",
    details: process.env.DEBUG_PIPELINE === "true" ? error.stack || error.message : undefined,
  };
}

export async function rankCandidates(input) {
  const startedAt = Date.now();
  try {
    const result = await runRankingPipeline(buildPipelineInput(input || {}), buildPipelineDeps());
    return {
      success: true,
      executionTime: Date.now() - startedAt,
      rankedCandidates: result.ranking.map(toApiCandidate),
    };
  } catch (error) {
    return {
      success: false,
      executionTime: Date.now() - startedAt,
      error: toApiError(error),
    };
  }
}

export async function evaluateProjectCandidates(input) {
  const startedAt = Date.now();
  try {
    const result = await runProjectEvaluationPipeline(input || {}, buildPipelineDeps());
    return {
      success: true,
      executionTime: Date.now() - startedAt,
      ...result,
    };
  } catch (error) {
    return {
      success: false,
      executionTime: Date.now() - startedAt,
      error: toApiError(error),
    };
  }
}

export default rankCandidates;
