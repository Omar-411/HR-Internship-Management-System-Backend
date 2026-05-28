import fs from "fs";
import { createRequire } from "module";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

// Import pure pipeline and service dependencies
import { runRankingPipeline } from "../../core/pipeline.js";
import { getEmbedding, cosineSimilarity } from "../../core/services/embedding.service.js";
import { getValidatedCommentary, getChatCompletion } from "../../core/services/llm.service.js";
import { validateCandidateSchema } from "../../validation/schema.js";
import { normalizeSkills, normalizeDomains, buildContextText } from "../../normalization/skills.js";
import { deepCopy, deepFreeze, stableCandidateFingerprint } from "../../normalization/fingerprint.js";
import { calibrateRoleScores, countSkillOccurrences, dampenFrequency, clampScore } from "../../core/services/scoring.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Enforce caching for deterministic validation runs
process.env.ENABLE_GROQ_CACHE = "true";
process.env.ENABLE_EMBEDDING_CACHE = "true";

async function runNoiseTest() {
  const noiseDatasetPath = "./validation/noise_dataset.json";
  if (!fs.existsSync(noiseDatasetPath)) {
    console.error(JSON.stringify({ error: `Noise dataset not found at ${noiseDatasetPath}` }));
    process.exit(1);
  }

  const noiseData = JSON.parse(fs.readFileSync(noiseDatasetPath, "utf8"));

  const cvs = [];
  noiseData.forEach(pair => {
    cvs.push({ id: pair.base.id, name: pair.base.name, text: pair.base.text });
    cvs.push({ id: pair.variant.id, name: pair.variant.name, text: pair.variant.text });
  });

  const project = {
    name: "General Tech Project",
    sector: "Technology",
    description: "A diverse technical project utilizing React, Python, AWS, and Machine Learning.",
  };

  const REQUIRED_TECHNOLOGIES = ["react", "python", "aws"];
  const PREFERRED_TECHNOLOGIES = ["docker", "tensorflow"];
  const ROLE_TYPES = ["Frontend Developer", "Data Scientist", "DevOps Engineer"];

  const pipelineInput = {
    cvs,
    project,
    REQUIRED_TECHNOLOGIES,
    PREFERRED_TECHNOLOGIES,
    ROLE_TYPES,
    options: { audit: true }
  };

  const pipelineDeps = {
    getEmbedding,
    getValidatedCommentary,
    getChatCompletion,
    validateCandidateSchema,
    normalizeSkills,
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

  console.log("Running Noise Robustness Tests...");

  const result = await runRankingPipeline(pipelineInput, pipelineDeps);
  const ranking = result.ranking;

  const getScore = (name) => {
    const candidate = ranking.find(c => c.name === name);
    return candidate ? candidate.score : null;
  };

  let failures = 0;
  let warnings = 0;
  const maxAcceptableDelta = 8; // Score delta above this will fail

  console.log("\n--- START NOISE ROBUSTNESS REPORT ---");
  
  noiseData.forEach((pair, index) => {
    const baseScore = getScore(pair.base.name);
    const varScore = getScore(pair.variant.name);

    if (baseScore === null || varScore === null) {
      console.error(`[FAIL] Pair ${index + 1} missing from rankings!`);
      failures++;
      return;
    }

    const delta = Math.abs(baseScore - varScore);
    const stabilityPct = (1 - (delta / 100)) * 100;
    
    console.log(`Pair ${index + 1}: ${pair.base.name} (Score: ${baseScore}) vs ${pair.variant.name} (Score: ${varScore}) | Delta: ${delta.toFixed(2)} | Stability: ${stabilityPct.toFixed(1)}%`);

    if (delta > maxAcceptableDelta) {
      console.error(`[FAIL] Score delta (${delta.toFixed(2)}) exceeded maximum threshold of ${maxAcceptableDelta}.`);
      failures++;
    } else if (delta > 4) {
      console.warn(`[WARNING] Score delta (${delta.toFixed(2)}) is noticeable.`);
      warnings++;
    }
  });

  console.log(`\nNoise Robustness Summary: ${failures} Failures, ${warnings} Warnings`);
  console.log("--- END NOISE ROBUSTNESS REPORT ---");

  if (failures > 0) {
    console.error(`[FAIL] Noise robustness checks failed with ${failures} errors.`);
    process.exit(1);
  }

  console.log("[SUCCESS] All Noise Robustness Validation Checks Passed!");
  process.exit(0);
}

runNoiseTest().catch(err => {
  console.error(JSON.stringify({ error: err.message, stack: err.stack }));
  process.exit(1);
});
