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

const nodeRequire = createRequire(import.meta.url);
const pdfModule = nodeRequire("pdf-parse");
const pdf = pdfModule.default || pdfModule;

async function runRoleLeakageTest() {
  const files = {
    cv_hanen: "./samples/cvs/cv_hanen.pdf",
    mlk: "./samples/cvs/mlk.pdf",
    yassmine: "./samples/cvs/yassmine.pdf",
    resume: "./samples/cvs/resume.pdf",
    ayusha: "./samples/cvs/ayusha.pdf"
  };

  const cvs = await Promise.all(
    Object.entries(files).map(async ([candidateId, path], index) => {
      if (!fs.existsSync(path)) throw new Error(`PDF not found: ${path}`);
      const buffer = fs.readFileSync(path);
      const parsedPdf = await pdf(buffer);
      return {
        id: candidateId,
        name: `Candidate ${index + 1}`, // Will be overwritten by LLM extraction, but just in case
        text: parsedPdf.text,
      };
    })
  );

  const project = {
    name: "Airport Operations & Delay Prediction Platform",
    sector: "Aviation / Smart Systems",
    description: "A real-time flight delay forecasting system using a React frontend, Node.js + Express backend, MongoDB database, and microservices.",
  };

  const REQUIRED_TECHNOLOGIES = ["node.js", "javascript", "react", "express.js", "mongodb"];
  const PREFERRED_TECHNOLOGIES = ["typescript", "docker", "aws", "rest apis"];
  
  // Inject Unrelated Roles!
  const ROLE_TYPES = [
    "Frontend Developer", 
    "Backend Engineer", 
    "Full-stack Developer",
    "AI Research Scientist",
    "DevOps Engineer",
    "Cybersecurity Analyst",
    "Game Developer"
  ];

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

  console.log("Running Role Leakage & Distribution Shift Tests...");

  const result = await runRankingPipeline(pipelineInput, pipelineDeps);
  
  let failures = 0;
  let warnings = 0;

  console.log("\n--- START ROLE LEAKAGE REPORT ---");

  const unrelatedRoles = ["AI Research Scientist", "DevOps Engineer", "Cybersecurity Analyst", "Game Developer"];

  result.ranking.forEach(candidate => {
    console.log(`Candidate: ${candidate.name} | Assigned Role: ${candidate.role} | Score: ${candidate.score}`);
    
    // Check if the assigned role is one of the unrelated roles
    if (unrelatedRoles.includes(candidate.role)) {
      console.error(`[FAIL] Candidate ${candidate.name} was assigned unrelated role: ${candidate.role}`);
      failures++;
    } else {
      console.log(`[PASS] Candidate ${candidate.name} kept an expected web role.`);
    }

    // Check if unrelated roles have high scores in the breakdown
    if (candidate.audit) {
       unrelatedRoles.forEach(uRole => {
          if (candidate.audit[uRole]) {
             const uScore = candidate.audit[uRole].afterScore || 0;
             if (uScore > 40) {
                 console.warn(`[WARNING] Candidate ${candidate.name} got a suspiciously high score (${uScore}) for unrelated role: ${uRole}`);
                 warnings++;
             }
          }
       });
    }
  });

  console.log(`\nRole Leakage Summary: ${failures} Failures, ${warnings} Warnings`);
  console.log("--- END ROLE LEAKAGE REPORT ---");

  if (failures > 0) {
    console.error(`[FAIL] Role Leakage checks failed with ${failures} errors.`);
    process.exit(1);
  }

  console.log("[SUCCESS] All Role Leakage Validation Checks Passed!");
  process.exit(0);
}

runRoleLeakageTest().catch(err => {
  console.error(JSON.stringify({ error: err.message, stack: err.stack }));
  process.exit(1);
});
