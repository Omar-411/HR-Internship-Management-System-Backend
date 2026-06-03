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

const nodeRequire = createRequire(import.meta.url);
const pdfModule = nodeRequire("pdf-parse");
const pdf = pdfModule.default || pdfModule;

async function runAccuracyTest() {
  const groundTruthPath = "./validation/dataset/ground_truth.json";
  if (!fs.existsSync(groundTruthPath)) {
    console.error(JSON.stringify({ error: `Ground truth dataset not found at ${groundTruthPath}` }));
    process.exit(1);
  }

  const groundTruth = JSON.parse(fs.readFileSync(groundTruthPath, "utf8"));

  const files = {
    cv_hanen: "./samples/cvs/cv_hanen.pdf",
    mlk: "./samples/cvs/mlk.pdf",
    yassmine: "./samples/cvs/yassmine.pdf",
    resume: "./samples/cvs/resume.pdf",
    ayusha: "./samples/cvs/ayusha.pdf"
  };

  const cvs = await Promise.all(
    Object.entries(files).map(async ([candidateId, path], index) => {
      if (!fs.existsSync(path)) {
        throw new Error(`PDF file not found: ${path}`);
      }
      const buffer = fs.readFileSync(path);
      const parsedPdf = await pdf(buffer);
      return {
        id: candidateId,
        name: `Candidate ${index + 1}`,
        text: parsedPdf.text,
      };
    })
  );

  const project = {
    name: "Airport Operations & Delay Prediction Platform",
    sector: "Aviation / Smart Systems",
    description:
      "A real-time flight delay forecasting system using a React frontend, Node.js + Express backend, MongoDB database, and microservices. Scalability and zero-downtime reliability are paramount.",
  };

  const REQUIRED_TECHNOLOGIES = ["node.js", "javascript", "react", "express.js", "mongodb"];
  const PREFERRED_TECHNOLOGIES = ["typescript", "docker", "aws", "rest apis"];
  const ROLE_TYPES = ["Frontend Developer", "Backend Engineer", "Full-stack Developer"];

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

  const result = await runRankingPipeline(pipelineInput, pipelineDeps);
  const totalCandidates = result.ranking.length;

  let roleMatches = 0;
  let rankingDistancesSum = 0;
  let totalSkillRecallSum = 0;
  let mustOutrankViolations = 0;
  const candidateDetails = [];

  const findCandidateByGroundTruthName = (gtName) => {
    return result.ranking.find(r => {
      const parts = gtName.toLowerCase().split(" ");
      return parts.some(part => r.name.toLowerCase().includes(part));
    });
  };

  for (const entry of groundTruth.entries) {
    const candidate = findCandidateByGroundTruthName(entry.name);
    if (!candidate) {
      console.error(JSON.stringify({ error: `Could not match candidate ${entry.name} in ranking` }));
      process.exit(1);
    }

    // 1. Role Accuracy
    const isRoleMatch = candidate.role === entry.expectedPrimaryRole;
    if (isRoleMatch) {
      roleMatches++;
    }

    // 2. Ranking Distance Accuracy
    const actualRank = candidate.rank;
    const [minRange, maxRange] = entry.expectedRankRange;
    let deviation = 0;
    if (actualRank < minRange) {
      deviation = minRange - actualRank;
    } else if (actualRank > maxRange) {
      deviation = actualRank - maxRange;
    }
    const candidateRankScore = 1 - (deviation / totalCandidates);
    rankingDistancesSum += candidateRankScore;

    // 3. Skill Recall
    const actualSkillsNormalized = (candidate.technicalSkills || []).map(s => normalizeRoleSkillAlias(s));
    const expectedSkillsNormalized = (entry.expectedTopSkills || []).map(s => normalizeRoleSkillAlias(s));
    
    const matchedSkills = expectedSkillsNormalized.filter(s => actualSkillsNormalized.includes(s));
    const skillRecall = expectedSkillsNormalized.length > 0 
      ? matchedSkills.length / expectedSkillsNormalized.length 
      : 1.0;
    totalSkillRecallSum += skillRecall;

    // 4. Must Outrank Violations
    const outrankStatus = [];
    (entry.mustOutrank || []).forEach(targetName => {
      const targetCand = findCandidateByGroundTruthName(targetName);
      if (targetCand) {
        const isViolation = actualRank > targetCand.rank; // Higher rank number means lower position
        if (isViolation) {
          mustOutrankViolations++;
        }
        outrankStatus.push({
          target: targetName,
          targetActualRank: targetCand.rank,
          candidateActualRank: actualRank,
          violated: isViolation
        });
      }
    });

    candidateDetails.push({
      name: entry.name,
      actualRole: candidate.role,
      expectedPrimaryRole: entry.expectedPrimaryRole,
      roleMatched: isRoleMatch,
      actualRank,
      expectedRankRange: entry.expectedRankRange,
      rankAccuracyScore: candidateRankScore,
      skillRecall,
      outrankStatus
    });
  }

  const finalReport = {
    datasetVersion: groundTruth.datasetVersion,
    roleAccuracy: (roleMatches / totalCandidates) * 100,
    rankingAccuracy: (rankingDistancesSum / totalCandidates) * 100,
    skillRecall: (totalSkillRecallSum / totalCandidates) * 100,
    mustOutrankViolations,
    candidateDetails
  };

  // Structured, machine-readable JSON output
  console.log("--- START ACCURACY REPORT ---");
  console.log(JSON.stringify(finalReport, null, 2));
  console.log("--- END ACCURACY REPORT ---");

  if (mustOutrankViolations > 0) {
    console.error(`[FAIL] Accuracy checks failed with ${mustOutrankViolations} mustOutrank violations.`);
    process.exit(1);
  }

  if (finalReport.roleAccuracy < 100) {
    console.error(`[FAIL] Accuracy checks failed with role accuracy at ${finalReport.roleAccuracy}%.`);
    process.exit(1);
  }

  console.log("[SUCCESS] All Ground-Truth Accuracy Validation Checks Passed!");
  process.exit(0);
}

runAccuracyTest().catch(err => {
  console.error(JSON.stringify({ error: err.message, stack: err.stack }));
  process.exit(1);
});
