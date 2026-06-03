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

// Determine configuration modes based on CLI arguments
const isCI = process.argv.includes("deterministic-cache=true") || !process.argv.includes("live-llm=true");

if (isCI) {
  process.env.ENABLE_GROQ_CACHE = "true";
  process.env.ENABLE_EMBEDDING_CACHE = "true";
} else {
  process.env.ENABLE_GROQ_CACHE = "false";
  process.env.ENABLE_EMBEDDING_CACHE = "false";
}

const nodeRequire = createRequire(import.meta.url);
const pdfModule = nodeRequire("pdf-parse");
const pdf = pdfModule.default || pdfModule;

async function runStabilitySuite() {
  // Configurable runs N (default 20, up to 50)
  let runsArg = process.argv.find(arg => arg.startsWith("runs="));
  let N = 20;
  if (runsArg) {
    const val = parseInt(runsArg.split("=")[1], 10);
    if (!isNaN(val) && val >= 2 && val <= 50) {
      N = val;
    }
  } else if (!isCI) {
    N = 3; // Keep it low for live remote API runs to protect rate limits unless specified
  }

  console.log(`Starting CV Pipeline Stability Test Suite (${N} runs)...`);
  console.log(`Mode: ${isCI ? "deterministic-cache (CI Mode)" : "live-llm (Debug Mode)"}`);
  console.log(`ENABLE_GROQ_CACHE: ${process.env.ENABLE_GROQ_CACHE}`);
  console.log(`ENABLE_EMBEDDING_CACHE: ${process.env.ENABLE_EMBEDDING_CACHE}\n`);

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
        name: `Candidate ${index + 1}`,
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
  const ROLE_TYPES = ["Frontend Developer", "Backend Engineer", "Full-stack Developer"];

  const pipelineInput = {
    cvs,
    project,
    REQUIRED_TECHNOLOGIES,
    PREFERRED_TECHNOLOGIES,
    ROLE_TYPES,
    options: { audit: false }
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

  const runResults = [];
  for (let i = 0; i < N; i++) {
    process.stdout.write(`  Executing run ${i + 1}/${N}...`);
    const t0 = Date.now();
    const result = await runRankingPipeline(pipelineInput, pipelineDeps);
    process.stdout.write(` Done (${Date.now() - t0}ms)\n`);
    runResults.push(result);
  }

  // 1. Gather per-candidate data
  const candidateNames = [...new Set(runResults[0].ranking.map(r => r.name))];
  const perCandidateScores = {};
  const perCandidateRanks = {};

  candidateNames.forEach(name => {
    perCandidateScores[name] = [];
    perCandidateRanks[name] = [];
  });

  runResults.forEach(run => {
    run.ranking.forEach(c => {
      const name = c.name || "Unknown";
      if (!perCandidateScores[name]) {
        perCandidateScores[name] = [];
        perCandidateRanks[name] = [];
      }
      perCandidateScores[name].push(c.score);
      perCandidateRanks[name].push(c.rank);
    });
  });

  // Calculate stats per candidate
  const candidateStats = {};
  let totalScoreStdDevSum = 0;

  candidateNames.forEach(name => {
    const scores = perCandidateScores[name];
    const ranks = perCandidateRanks[name];

    const meanScore = scores.reduce((sum, s) => sum + s, 0) / N;
    const squaredDiffs = scores.map(s => Math.pow(s - meanScore, 2));
    const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / N;
    const stdDev = Math.sqrt(variance);
    totalScoreStdDevSum += stdDev;

    // Rank Positional Distribution
    const rankCounts = {};
    ranks.forEach(r => {
      rankCounts[r] = (rankCounts[r] || 0) + 1;
    });

    // Frequency of rank changes
    let rankChanges = 0;
    for (let i = 1; i < ranks.length; i++) {
      if (ranks[i] !== ranks[i - 1]) {
        rankChanges++;
      }
    }

    candidateStats[name] = {
      scoreVariance: stdDev,
      rankPositionDistribution: rankCounts,
      frequencyOfRankChanges: rankChanges
    };
  });

  // 2. System level metrics
  // Rank Flip Rate: percentage of consecutive run pairs with any rank changes
  let orderFlips = 0;
  for (let i = 1; i < N; i++) {
    const prevOrder = runResults[i - 1].ranking.map(r => r.name).join(",");
    const currOrder = runResults[i].ranking.map(r => r.name).join(",");
    if (prevOrder !== currOrder) {
      orderFlips++;
    }
  }
  const rankFlipRate = N > 1 ? orderFlips / (N - 1) : 0.0;

  // Top-1 stability rate
  const top1Counts = {};
  runResults.forEach(run => {
    const top1Name = run.ranking[0]?.name || "Unknown";
    top1Counts[top1Name] = (top1Counts[top1Name] || 0) + 1;
  });
  const maxTop1Count = Math.max(...Object.values(top1Counts));
  const top1Stability = maxTop1Count / N;

  const avgScoreStdDev = totalScoreStdDevSum / candidateNames.length;

  // Compute overall stability score (0 to 100)
  // Perfectly stable (CI cached mode) should return exactly 100.
  const stabilityScore = Math.max(0, Math.min(100, Math.round(
    100 * (1 - rankFlipRate) * top1Stability * Math.max(0, 1 - avgScoreStdDev / 50)
  )));

  const finalReport = {
    stabilityScore,
    rankFlipRate,
    top1Stability,
    avgScoreStdDev,
    candidateAnalysis: candidateStats
  };

  console.log("\n--- START STABILITY REPORT ---");
  console.log(JSON.stringify(finalReport, null, 2));
  console.log("--- END STABILITY REPORT ---");

  if (isCI && stabilityScore < 100) {
    console.error(`[FAIL] Stability verification failed! Cached system behavior was non-deterministic. Score: ${stabilityScore}%`);
    process.exit(1);
  }

  console.log("[SUCCESS] Stability suite executed and verified successfully!");
  process.exit(0);
}

runStabilitySuite().catch(err => {
  console.error(JSON.stringify({ error: err.message, stack: err.stack }));
  process.exit(1);
});
