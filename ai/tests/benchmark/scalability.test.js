import fs from "fs";
import path from "path";
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

// Custom wrapper to handle Groq rate limits with exponential backoff
async function resilientGetChatCompletion(params, retries = 5, backoffMs = 2000) {
  try {
    return await getChatCompletion(params);
  } catch (err) {
    if (retries > 0 && err.status === 429) {
      console.warn(`Rate limited by Groq. Retrying in ${backoffMs}ms...`);
      await new Promise(res => setTimeout(res, backoffMs));
      return resilientGetChatCompletion(params, retries - 1, backoffMs * 2);
    }
    throw err;
  }
}

function computeStandardDeviation(scores) {
  if (scores.length === 0) return 0;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length;
  return Math.sqrt(variance);
}

function getTopKNames(ranking, k) {
  return ranking.slice(0, k).map(c => c.name);
}

async function runScalabilityTest() {
  const smallDatasetPath = "./validation/baseline/cvs.json";
  const mediumDatasetPath = "./validation/dataset/medium_scale.json";
  const largeDatasetPath = "./validation/dataset/large_scale.json";

  if (!fs.existsSync(mediumDatasetPath) || !fs.existsSync(largeDatasetPath)) {
    console.error("[FAIL] Scaled datasets missing. Run generate_scale_datasets.js first.");
    process.exit(1);
  }

  const cvsSmall = JSON.parse(fs.readFileSync(smallDatasetPath, "utf8"));
  const cvsMedium = JSON.parse(fs.readFileSync(mediumDatasetPath, "utf8"));
  const cvsLarge = JSON.parse(fs.readFileSync(largeDatasetPath, "utf8"));

  const project = {
    name: "Enterprise Scalability Platform",
    sector: "Technology",
    description: "A comprehensive project involving full-stack web applications, React, Node.js, databases, and enterprise architecture.",
  };

  const REQUIRED_TECHNOLOGIES = ["javascript", "react", "node.js"];
  const PREFERRED_TECHNOLOGIES = ["express.js", "mongodb"];
  const ROLE_TYPES = ["Frontend Developer", "Backend Engineer", "Fullstack Developer"];

  const buildPipelineInput = (cvs) => ({
    cvs,
    project,
    REQUIRED_TECHNOLOGIES,
    PREFERRED_TECHNOLOGIES,
    ROLE_TYPES,
    options: { audit: true }
  });

  const pipelineDeps = {
    getEmbedding,
    // Mock commentary to save massive LLM time and focus solely on Ranking Math
    getValidatedCommentary: async () => JSON.stringify({ ranking: [] }),
    getChatCompletion: resilientGetChatCompletion,
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

  console.log("=== STARTING SCALABILITY STRESS TESTS ===\n");

  let failures = 0;

  // --- SMALL BENCHMARK ---
  console.log("Running Small Benchmark (5 candidates)...");
  const t0 = Date.now();
  const resSmall = await runRankingPipeline(buildPipelineInput(cvsSmall), pipelineDeps);
  const timeSmall = Date.now() - t0;
  console.log(`Finished in ${timeSmall}ms.\n`);

  const nameToPrefix = (name) => {
    const lower = name.toLowerCase();
    if (lower.includes("hanen") || lower.includes("candidate 1")) return "Candidate 1";
    if (lower.includes("malek") || lower.includes("candidate 2")) return "Candidate 2";
    if (lower.includes("yasmine") || lower.includes("hmida") || lower.includes("candidate 3")) return "Candidate 3";
    if (lower.includes("hugo") || lower.includes("candidate 4")) return "Candidate 4";
    if (lower.includes("aayush") || lower.includes("candidate 5")) return "Candidate 5";
    return name;
  };

  const top3Small = getTopKNames(resSmall.ranking, 3);
  console.log("Top 3 original candidates:", top3Small);
  
  // Normalize original names to prefixes
  const top3OriginalPrefixes = resSmall.ranking.slice(0, 3).map(c => nameToPrefix(c.name.trim()));
  console.log("Top 3 original prefixes:", top3OriginalPrefixes);

  // Helper to verify Top-K drift
  function verifyDrift(ranking, setName, datasetSize) {
    const K = Math.max(10, Math.ceil(datasetSize * 0.60));
    const topKNames = getTopKNames(ranking, K);
    const topKPrefixes = topKNames.map(n => nameToPrefix(n));
    
    console.log(`[${setName}] Top-${K} Candidate Names:`, topKNames);
    console.log(`[${setName}] Top-${K} Candidate Prefixes:`, topKPrefixes);
    
    // Check if the mutated variants of the original top 3 are inside the top K
    let preservedCount = 0;
    
    top3OriginalPrefixes.forEach(prefix => {
      if (topKPrefixes.includes(prefix)) {
        preservedCount++;
      }
    });

    const driftPercent = ((3 - preservedCount) / 3) * 100;
    
    console.log(`[${setName}] Top-K (K=${K}) Drift: ${driftPercent.toFixed(1)}% (Preserved ${preservedCount}/3 original top candidates in Top ${K})`);
    
    if (driftPercent > 20) {
      console.error(`  -> [FAIL] Top-K Consistency Drift exceeded 20% limit!`);
      failures++;
    }
  }

  // Helper to verify Score Clustering (Variance)
  function verifyVariance(ranking, setName) {
    const scores = ranking.map(c => c.score);
    const stdDev = computeStandardDeviation(scores);
    console.log(`[${setName}] Score Standard Deviation: ${stdDev.toFixed(2)}`);
    
    if (stdDev < 5) {
      console.error(`  -> [FAIL] Score variance collapsed (StdDev < 5). System is over-clustering!`);
      failures++;
    }
  }

  // Helper to verify Embedding Dominance
  function verifyEmbeddingDominance(ranking, setName) {
    let totalRatio = 0;
    let validCount = 0;
    
    ranking.forEach(c => {
      if (c.score > 0) {
        const embScore = c.projectMatchScore || 0;
        totalRatio += (embScore / c.score);
        validCount++;
      }
    });

    const avgRatio = validCount > 0 ? totalRatio / validCount : 0;
    console.log(`[${setName}] Avg Embedding Dominance Ratio: ${avgRatio.toFixed(2)}`);
    
    if (avgRatio > 0.65) {
      console.error(`  -> [FAIL] Embedding dominance exceeded safe bounds (> 0.65).`);
      failures++;
    }
  }

  // --- MEDIUM BENCHMARK ---
  console.log("Running Medium Benchmark (50 candidates)...");
  const t1 = Date.now();
  const resMedium = await runRankingPipeline(buildPipelineInput(cvsMedium), pipelineDeps);
  const timeMedium = Date.now() - t1;
  console.log(`Finished in ${timeMedium}ms.`);
  
  verifyDrift(resMedium.ranking, "Medium", 50);
  verifyVariance(resMedium.ranking, "Medium");
  verifyEmbeddingDominance(resMedium.ranking, "Medium");
  console.log("");

  // --- LARGE BENCHMARK ---
  console.log("Running Large Benchmark (100 candidates)...");
  const t2 = Date.now();
  const resLarge = await runRankingPipeline(buildPipelineInput(cvsLarge), pipelineDeps);
  const timeLarge = Date.now() - t2;
  console.log(`Finished in ${timeLarge}ms.`);
  
  verifyDrift(resLarge.ranking, "Large", 100);
  verifyVariance(resLarge.ranking, "Large");
  verifyEmbeddingDominance(resLarge.ranking, "Large");
  console.log("");

  // --- DETERMINISTIC CHECK ---
  console.log("Running Deterministic Repeatability Check on Large set...");
  const t3 = Date.now();
  const resLargeRepeat = await runRankingPipeline(buildPipelineInput(cvsLarge), pipelineDeps);
  const isDeterministic = JSON.stringify(resLarge.ranking) === JSON.stringify(resLargeRepeat.ranking);
  console.log(`Finished in ${Date.now() - t3}ms.`);
  
  if (!isDeterministic) {
    console.error("  -> [FAIL] Large benchmark runs are not deterministic! Caching or pure functions are failing.");
    failures++;
  } else {
    console.log("  -> [PASS] System is 100% deterministic at scale.");
  }

  console.log("\n=== SCALABILITY REPORT SUMMARY ===");
  console.log(`Small : ${timeSmall}ms`);
  console.log(`Medium: ${timeMedium}ms`);
  console.log(`Large : ${timeLarge}ms`);
  
  if (timeMedium > 5 * 60 * 1000) {
    console.warn(`[WARNING] Medium dataset took longer than 5 minutes!`);
  }
  if (timeLarge > 10 * 60 * 1000) {
    console.warn(`[WARNING] Large dataset took longer than 10 minutes!`);
  }

  if (failures > 0) {
    console.error(`\n[FAIL] Scalability benchmark failed with ${failures} errors.`);
    process.exit(1);
  }

  console.log("\n[SUCCESS] Scalability Stress Tests Passed Successfully!");
  process.exit(0);
}

runScalabilityTest().catch(err => {
  console.error(JSON.stringify({ error: err.message, stack: err.stack }));
  process.exit(1);
});
