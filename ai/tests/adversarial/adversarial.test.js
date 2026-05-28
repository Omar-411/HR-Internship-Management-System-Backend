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
import { calibrateRoleScores, countSkillOccurrences, dampenFrequency, clampScore, normalizeRoleSkillAlias } from "../../core/services/scoring.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Enforce caching for deterministic validation runs
process.env.ENABLE_GROQ_CACHE = "true";
process.env.ENABLE_EMBEDDING_CACHE = "true";

async function runAdversarialTest() {
  const adversarialDatasetPath = "./validation/adversarial_dataset.json";
  if (!fs.existsSync(adversarialDatasetPath)) {
    console.error(JSON.stringify({ error: `Adversarial dataset not found at ${adversarialDatasetPath}` }));
    process.exit(1);
  }

  const adversarialData = JSON.parse(fs.readFileSync(adversarialDatasetPath, "utf8"));

  const cvs = adversarialData.map(c => ({
    id: c.id,
    name: c.name,
    text: c.text
  }));

  const project = {
    name: "Standard Web Project",
    sector: "Technology",
    description: "A standard web application using React, Node.js, and MongoDB.",
  };

  const REQUIRED_TECHNOLOGIES = ["node.js", "javascript", "react", "mongodb"];
  const PREFERRED_TECHNOLOGIES = ["typescript", "docker"];
  const ROLE_TYPES = ["Frontend Developer", "Backend Engineer", "Fullstack Developer"];

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

  console.log("Running Adversarial Tests...");

  let result;
  try {
    result = await runRankingPipeline(pipelineInput, pipelineDeps);
  } catch (error) {
    console.error("[FAIL] Pipeline crashed on adversarial input!");
    console.error(error);
    process.exit(1);
  }

  const ranking = result.ranking;
  let failures = 0;
  let warnings = 0;

  console.log("\n--- START ADVERSARIAL REPORT ---");

  const emptyCV = ranking.find(c => c.name === "Empty Void");
  if (emptyCV) {
    if (emptyCV.rank > ranking.length - 2) {
      console.log(`[PASS] Empty CV ranked at the bottom (Rank: ${emptyCV.rank}, Score: ${emptyCV.score})`);
    } else {
      console.error(`[FAIL] Empty CV did not rank at the bottom. Ranked: ${emptyCV.rank}`);
      failures++;
    }
    if (emptyCV.score > 30) {
      console.error(`[FAIL] Empty CV score ceiling exceeded. Score: ${emptyCV.score}`);
      failures++;
    }
  } else {
    console.error(`[FAIL] Empty CV missing from ranking!`);
    failures++;
  }

  // 2. Spammer should not dominate (e.g. score < 100, should not be perfect)
  const spammer = ranking.find(c => c.name === "Spammer Keywords");
  if (spammer) {
    if (spammer.score >= 95) {
      console.warn(`[WARNING] Keyword spammer achieved extremely high score: ${spammer.score}`);
      warnings++;
    } else {
      console.log(`[PASS] Keyword spammer handled gracefully (Score: ${spammer.score})`);
    }
  }

  // 3. Fake Senior / Inflated should not bypass structural checks to get 100
  const overqualified = ranking.find(c => c.name === "Fake Senior Architect");
  if (overqualified) {
    if (overqualified.score >= 90) {
      console.warn(`[WARNING] Fake Senior CV got very high score: ${overqualified.score}`);
      warnings++;
    } else {
      console.log(`[PASS] Fake Senior CV score contained (Score: ${overqualified.score})`);
    }
  }
  
  const inflator = ranking.find(c => c.name === "Semantic Inflator");
  if (inflator) {
    if (inflator.score >= 80) {
      console.warn(`[WARNING] Semantic Inflator got very high score: ${inflator.score}`);
      warnings++;
    } else {
      console.log(`[PASS] Semantic Inflator score contained (Score: ${inflator.score})`);
    }
  }
  
  const malformed = ranking.find(c => c.name === "Corrupted Structure");
  if (malformed) {
    console.log(`[PASS] Malformed CV did not crash pipeline and was processed (Score: ${malformed.score})`);
  }

  console.log(`\nAdversarial Summary: ${failures} Failures, ${warnings} Warnings`);
  console.log("--- END ADVERSARIAL REPORT ---");

  if (failures > 0) {
    console.error(`[FAIL] Adversarial checks failed with ${failures} errors.`);
    process.exit(1);
  }

  // Determinism check (run again and expect exact same scores)
  const result2 = await runRankingPipeline(pipelineInput, pipelineDeps);
  const isDeterministic = JSON.stringify(result.ranking) === JSON.stringify(result2.ranking);
  
  if (!isDeterministic) {
    console.error("[FAIL] Adversarial tests failed: Outputs are non-deterministic on repeated runs.");
    process.exit(1);
  } else {
    console.log("[PASS] Adversarial inputs yield deterministic rankings.");
  }

  console.log("[SUCCESS] All Adversarial Validation Checks Passed!");
  process.exit(0);
}

runAdversarialTest().catch(err => {
  console.error(JSON.stringify({ error: err.message, stack: err.stack }));
  process.exit(1);
});
