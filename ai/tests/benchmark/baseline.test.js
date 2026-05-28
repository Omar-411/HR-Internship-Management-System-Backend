import fs from "fs";
import path from "path";
import { createRequire } from "module";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

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

const nodeRequire = createRequire(import.meta.url);
const pdfModule = nodeRequire("pdf-parse");
const pdf = pdfModule.default || pdfModule;

async function generateSnapshot(pipelineInput, pipelineDeps, snapshotPaths) {
  console.log("Generating initial baseline snapshot...");
  const result = await runRankingPipeline(pipelineInput, pipelineDeps);
  
  fs.writeFileSync(snapshotPaths.cvs, JSON.stringify(pipelineInput.cvs, null, 2));
  fs.writeFileSync(snapshotPaths.project, JSON.stringify({
    project: pipelineInput.project,
    REQUIRED_TECHNOLOGIES: pipelineInput.REQUIRED_TECHNOLOGIES,
    PREFERRED_TECHNOLOGIES: pipelineInput.PREFERRED_TECHNOLOGIES,
    ROLE_TYPES: pipelineInput.ROLE_TYPES,
  }, null, 2));
  
  // Extract essential ranking data for the snapshot
  const expectedRanking = result.ranking.map(c => ({
    name: c.name,
    rank: c.rank,
    score: c.score,
    role: c.role
  }));
  
  fs.writeFileSync(snapshotPaths.expectedRanking, JSON.stringify(expectedRanking, null, 2));
  console.log("Snapshot successfully generated!");
  return expectedRanking;
}

async function runBaselineTest() {
  const snapshotDir = "./validation/baseline";
  if (!fs.existsSync(snapshotDir)) {
    fs.mkdirSync(snapshotDir, { recursive: true });
  }

  const snapshotPaths = {
    cvs: path.join(snapshotDir, "cvs.json"),
    project: path.join(snapshotDir, "project.json"),
    expectedRanking: path.join(snapshotDir, "expected_ranking.json")
  };

  const files = {
    cv_hanen: "./samples/cvs/cv_hanen.pdf",
    mlk: "./samples/cvs/mlk.pdf",
    yassmine: "./samples/cvs/yassmine.pdf",
    resume: "./samples/cvs/resume.pdf",
    ayusha: "./samples/cvs/ayusha.pdf"
  };

  const cvs = await Promise.all(
    Object.entries(files).map(async ([candidateId, pdfPath], index) => {
      if (!fs.existsSync(pdfPath)) throw new Error(`PDF not found: ${pdfPath}`);
      const buffer = fs.readFileSync(pdfPath);
      const parsedPdf = await pdf(buffer);
      return {
        id: candidateId,
        name: `Candidate ${index + 1}`,
        text: parsedPdf.text,
      };
    })
  );

  const project = {
    name: "Standard Frozen Project",
    sector: "Technology",
    description: "A standard project to evaluate stability against.",
  };

  const REQUIRED_TECHNOLOGIES = ["javascript", "react", "mongodb"];
  const PREFERRED_TECHNOLOGIES = ["docker"];
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

  let expectedRanking;

  // Auto-generate snapshot if it doesn't exist
  if (!fs.existsSync(snapshotPaths.expectedRanking)) {
    expectedRanking = await generateSnapshot(pipelineInput, pipelineDeps, snapshotPaths);
  } else {
    expectedRanking = JSON.parse(fs.readFileSync(snapshotPaths.expectedRanking, "utf8"));
  }

  console.log("Running Frozen Baseline Verification...");

  const result = await runRankingPipeline(pipelineInput, pipelineDeps);
  const actualRanking = result.ranking;

  let failures = 0;
  let warnings = 0;
  
  console.log("\n--- START BASELINE DRIFT REPORT ---");

  expectedRanking.forEach(expected => {
    const actual = actualRanking.find(a => a.name === expected.name);
    
    if (!actual) {
      console.error(`[FAIL] Candidate ${expected.name} missing from actual ranking.`);
      failures++;
      return;
    }

    let candidateFailed = false;

    if (actual.rank !== expected.rank) {
      console.error(`[FAIL] ${expected.name} rank drift! Expected ${expected.rank}, Got ${actual.rank}`);
      candidateFailed = true;
      failures++;
    }

    if (actual.role !== expected.role) {
      console.error(`[FAIL] ${expected.name} role drift! Expected ${expected.role}, Got ${actual.role}`);
      candidateFailed = true;
      failures++;
    }

    const scoreDelta = Math.abs(actual.score - expected.score);
    if (scoreDelta > 2) {
      console.error(`[FAIL] ${expected.name} score drift exceeded 2! Expected ${expected.score}, Got ${actual.score} (Delta: ${scoreDelta.toFixed(2)})`);
      candidateFailed = true;
      failures++;
    } else if (scoreDelta > 0) {
      console.warn(`[WARNING] ${expected.name} minor score drift! Expected ${expected.score}, Got ${actual.score} (Delta: ${scoreDelta.toFixed(2)})`);
      warnings++;
    }

    if (!candidateFailed) {
      console.log(`[PASS] ${expected.name} matches baseline.`);
    }
  });

  console.log(`\nBaseline Summary: ${failures} Failures, ${warnings} Warnings`);
  console.log("--- END BASELINE DRIFT REPORT ---");

  if (failures > 0) {
    console.error(`[FAIL] Baseline validation failed with ${failures} errors.`);
    process.exit(1);
  }

  console.log("[SUCCESS] Baseline Snapshot Validation Checks Passed!");
  process.exit(0);
}

runBaselineTest().catch(err => {
  console.error(JSON.stringify({ error: err.message, stack: err.stack }));
  process.exit(1);
});
