/**
 * FULL BENCHMARK TEST v2 — Hard Assertions
 *
 * 50-CV deterministic dataset. Fixed seed ordering. No randomness.
 * First run builds the cache; subsequent runs are instant and identical.
 *
 * Usage:
 *   node tests/benchmark.test.js                  # Full benchmark (50 CVs)
 *   node tests/benchmark.test.js scale-only        # Scale tests only (10→25→50)
 *   node tests/benchmark.test.js no-stability      # Skip 3-run stability check
 */

import fs from "fs";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

import { runRankingPipeline } from "../../core/pipeline.js";
import { getEmbedding, cosineSimilarity } from "../../core/services/embedding.service.js";
import { getValidatedCommentary, getChatCompletion } from "../../core/services/llm.service.js";
import { validateCandidateSchema } from "../../validation/schema.js";
import { normalizeSkills, normalizeDomains, buildContextText } from "../../normalization/skills.js";
import { deepCopy, deepFreeze, stableCandidateFingerprint } from "../../normalization/fingerprint.js";
import {
  calibrateRoleScores,
  countSkillOccurrences,
  dampenFrequency,
  clampScore,
} from "../../core/services/scoring.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// ─── DETERMINISTIC MODE (always on for benchmark) ────────────────────────────
process.env.ENABLE_GROQ_CACHE = "true";
process.env.ENABLE_EMBEDDING_CACHE = "true";

// ─── CLI FLAGS ────────────────────────────────────────────────────────────────
const SCALE_ONLY    = process.argv.includes("scale-only");
const NO_STABILITY  = process.argv.includes("no-stability");
const NO_COMMENTARY = true; // always suppress commentary in benchmarks

// ─── ASSERTION FRAMEWORK ─────────────────────────────────────────────────────
const failures = [];
const warnings = [];

function assert(condition, label, detail = {}) {
  if (!condition) {
    failures.push({ label, ...detail });
    const detailStr = Object.entries(detail).map(([k, v]) => `    ${k}: ${v}`).join("\n");
    console.error(`  [FAIL] ${label}`);
    if (detailStr) console.error(detailStr);
  } else {
    console.log(`  [PASS] ${label}`);
  }
}

function warn(condition, label, detail = {}) {
  if (!condition) {
    warnings.push({ label, ...detail });
    const detailStr = Object.entries(detail).map(([k, v]) => `    ${k}: ${v}`).join("\n");
    console.warn(`  [WARN] ${label}`);
    if (detailStr) console.warn(detailStr);
  }
}

// ─── MATH HELPERS ─────────────────────────────────────────────────────────────
function stdDev(arr) {
  if (arr.length === 0) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function topK(ranking, k) {
  return ranking.slice(0, k).map(c => c.id);
}

// ─── PIPELINE DEPS ─────────────────────────────────────────────────────────────
function buildPipelineDeps() {
  return {
    getEmbedding,
    getValidatedCommentary: NO_COMMENTARY
      ? async () => JSON.stringify({ ranking: [] })
      : getValidatedCommentary,
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
}

// ─── JOB SPECIFICATION (fixed for all benchmark runs) ────────────────────────
const BENCHMARK_PROJECT = {
  name: "Modern Web Platform",
  sector: "Technology",
  description: "A full-stack web application for enterprise customers using React, Node.js, Express.js, and MongoDB. Requires real-time capabilities and scalable REST APIs.",
};
const BENCHMARK_REQUIRED  = ["react", "node.js", "mongodb"];
const BENCHMARK_PREFERRED = ["express.js", "javascript", "typescript", "docker"];
const BENCHMARK_ROLES     = ["Frontend Developer", "Backend Engineer", "Fullstack Developer"];

function buildPipelineInput(cvSubset) {
  return {
    cvs: cvSubset.map(cv => ({ id: cv.id, name: cv.name, text: cv.text })),
    project: BENCHMARK_PROJECT,
    REQUIRED_TECHNOLOGIES: BENCHMARK_REQUIRED,
    PREFERRED_TECHNOLOGIES: BENCHMARK_PREFERRED,
    ROLE_TYPES: BENCHMARK_ROLES,
    options: { audit: false },
  };
}

// ─── DATASET LOADER ───────────────────────────────────────────────────────────
function loadDataset(path) {
  if (!fs.existsSync(path)) {
    console.error(`[ERROR] Dataset not found: ${path}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

// ─── MAIN BENCHMARK ───────────────────────────────────────────────────────────
async function runFullBenchmark() {
  const datasetPath = "./validation/benchmark_v2.json";
  const fullDataset = loadDataset(datasetPath);

  console.log(`\n${"═".repeat(70)}`);
  console.log("  BENCHMARK v2 — FULL ROBUSTNESS SUITE");
  console.log(`  Dataset: ${fullDataset.length} CVs | Job: ${BENCHMARK_PROJECT.name}`);
  console.log(`${"═".repeat(70)}\n`);

  // ── CATEGORY INDEXES ─────────────────────────────────────────────────────
  const byCategory = (cat) => fullDataset.filter(cv => cv.meta.category === cat);
  const strongMatches   = byCategory("strong_match");       // 15 CVs
  const partialMatches  = byCategory("partial_match");      // 12 CVs
  const weakMatches     = byCategory("weak_match");         // 8 CVs
  const advSpam         = byCategory("adversarial_spam");   // 2 CVs
  const advEmpty        = byCategory("adversarial_empty");  // 1 CV
  const advNoise        = byCategory("adversarial_noise");  // 3 CVs
  const advInflated     = byCategory("adversarial_inflated"); // 2 CVs
  const duplicates      = byCategory("duplicate");          // 4 CVs
  const crossDomain     = byCategory("cross_domain");       // 3 CVs

  console.log(`  Strong matches:  ${strongMatches.length}`);
  console.log(`  Partial matches: ${partialMatches.length}`);
  console.log(`  Weak matches:    ${weakMatches.length}`);
  console.log(`  Adversarial:     ${advSpam.length + advEmpty.length + advNoise.length + advInflated.length}`);
  console.log(`  Duplicates:      ${duplicates.length}`);
  console.log(`  Cross-domain:    ${crossDomain.length}`);
  console.log(`  Total:           ${fullDataset.length}\n`);

  const deps = buildPipelineDeps();
  const TOTAL = fullDataset.length;

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 1: SCALE TESTS (10 → 25 → 50 CVs)
  // ══════════════════════════════════════════════════════════════════════════
  console.log("─".repeat(70));
  console.log("  SECTION 1: SCALE STRESS TESTS (10 → 25 → 50 CVs)");
  console.log("─".repeat(70));

  const scale10 = fullDataset.slice(0, 10);
  const scale25 = fullDataset.slice(0, 25);
  const scale50 = fullDataset;

  console.log(`\n  Running 10-CV batch...`);
  const t10 = Date.now();
  const res10 = await runRankingPipeline(buildPipelineInput(scale10), deps);
  console.log(`  Done in ${Date.now() - t10}ms`);

  console.log(`\n  Running 25-CV batch...`);
  const t25 = Date.now();
  const res25 = await runRankingPipeline(buildPipelineInput(scale25), deps);
  console.log(`  Done in ${Date.now() - t25}ms`);

  console.log(`\n  Running 50-CV batch...`);
  const t50 = Date.now();
  const res50 = await runRankingPipeline(buildPipelineInput(scale50), deps);
  console.log(`  Done in ${Date.now() - t50}ms`);

  // Score variance at each scale
  const scores10 = res10.ranking.map(c => c.score);
  const scores25 = res25.ranking.map(c => c.score);
  const scores50 = res50.ranking.map(c => c.score);

  console.log(`\n  Scale Stats:`);
  console.log(`    10-CV: mean=${mean(scores10).toFixed(1)}, stddev=${stdDev(scores10).toFixed(2)}`);
  console.log(`    25-CV: mean=${mean(scores25).toFixed(1)}, stddev=${stdDev(scores25).toFixed(2)}`);
  console.log(`    50-CV: mean=${mean(scores50).toFixed(1)}, stddev=${stdDev(scores50).toFixed(2)}`);

  console.log("\n  Scale assertions:");
  assert(stdDev(scores10) > 5, "10-CV: Score stddev > 5 (no clustering)", { stddev: stdDev(scores10).toFixed(2) });
  assert(stdDev(scores25) > 6, "25-CV: Score stddev > 6 (no clustering)", { stddev: stdDev(scores25).toFixed(2) });
  assert(stdDev(scores50) > 8, "50-CV: Score stddev > 8 (no clustering)", { stddev: stdDev(scores50).toFixed(2) });

  // Top-K consistency: strong matches in 10-CV run must remain in top-K of 50-CV run
  const top3_10 = topK(res10.ranking, 3);
  const top15_50_ids = new Set(topK(res50.ranking, 15));
  const preserved = top3_10.filter(id => top15_50_ids.has(id)).length;
  const driftPct = ((top3_10.length - preserved) / top3_10.length) * 100;
  console.log(`\n    Top-3 from 10-CV run preserved in top-15 of 50-CV run: ${preserved}/3 (drift: ${driftPct.toFixed(0)}%)`);
  assert(driftPct <= 34, "Scale consistency: top-3 from 10-CV run appears in top-15 of 50-CV run", {
    preserved: `${preserved}/3`, drift: `${driftPct.toFixed(0)}%`
  });

  if (SCALE_ONLY) {
    console.log("\n  [scale-only mode] Skipping remaining sections.\n");
    printFinalReport();
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 2: FULL 50-CV HARD ASSERTIONS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + "─".repeat(70));
  console.log("  SECTION 2: HARD ASSERTIONS — FULL 50-CV RUN");
  console.log("─".repeat(70));

  const ranking = res50.ranking;
  const byId = Object.fromEntries(ranking.map(c => [c.id, c]));

  // ── ASSERTION A: Empty embedding cannot rank in top candidates ────────────
  console.log("\n  [A] Empty Embedding Sanity:");
  const emptyCV = byId["bv2_a02"];
  if (emptyCV) {
    assert(emptyCV.rank > TOTAL - 10, "Empty CV ranks in bottom 10", {
      id: "bv2_a02", rank: emptyCV.rank, total: TOTAL, score: emptyCV.score
    });
    assert(emptyCV.score < 10, "Empty CV score < 10", {
      id: "bv2_a02", score: emptyCV.score
    });
    // Embedding must not produce competitive ranking
    const embScore = emptyCV.debug?.embeddingScore ?? emptyCV.projectMatchScore ?? 0;
    assert(embScore < 15, "Empty CV embedding score < 15 (sanity gate)", {
      id: "bv2_a02", embeddingScore: embScore
    });
  } else {
    assert(false, "Empty CV (bv2_a02) found in ranking");
  }

  // ── ASSERTION B: Domain mismatch scores too high ──────────────────────────
  console.log("\n  [B] Domain Mismatch Scores:");
  const domainMismatchIds = [
    ...weakMatches.map(cv => cv.id),
    ...crossDomain.map(cv => cv.id),
  ];
  const domainMismatchCandidates = domainMismatchIds.map(id => byId[id]).filter(Boolean);
  const nurseCV   = byId["bv2_w01"];
  const hrCV      = byId["bv2_w02"];

  if (nurseCV) {
    assert(nurseCV.score < 25, "Nurse CV score < 25 for SWE job (domain mismatch)", {
      id: "bv2_w01", score: nurseCV.score, domain: nurseCV.assignedDomain
    });
  }
  if (hrCV) {
    assert(hrCV.score < 25, "HR Manager CV score < 25 for SWE job", {
      id: "bv2_w02", score: hrCV.score
    });
  }

  const highDomainMismatches = domainMismatchCandidates.filter(c => c.score > 35);
  assert(
    highDomainMismatches.length === 0,
    "No domain-mismatch CV scores above 35",
    { violations: highDomainMismatches.map(c => `${c.id}=${c.score}`).join(", ") || "none" }
  );

  // ── ASSERTION C: Keyword spam does not outperform genuine candidates ───────
  console.log("\n  [C] Anti-Keyword-Spam Defense:");
  const spammer1 = byId["bv2_a01"];
  const spammer2 = byId["bv2_a06"];
  const strongScores = strongMatches.map(cv => byId[cv.id]?.score ?? 0).filter(s => s > 0);
  const avgStrongScore = mean(strongScores);

  if (spammer1) {
    assert(
      spammer1.score < avgStrongScore,
      "Spammer (bv2_a01) scores below average strong match",
      { spammerScore: spammer1.score, avgStrongScore: avgStrongScore.toFixed(1) }
    );
    // Spammer must not be in top 20
    assert(
      spammer1.rank > 20,
      "Spammer (bv2_a01) rank > 20",
      { rank: spammer1.rank }
    );
  }
  if (spammer2) {
    assert(
      spammer2.score < avgStrongScore,
      "High-density spammer (bv2_a06) scores below average strong match",
      { spammerScore: spammer2.score, avgStrongScore: avgStrongScore.toFixed(1) }
    );
    assert(
      spammer2.rank > 20,
      "High-density spammer (bv2_a06) rank > 20",
      { rank: spammer2.rank }
    );
  }

  // Semantic inflator must not rank high
  const inflator = byId["bv2_a05"];
  if (inflator) {
    assert(inflator.score < 40, "Semantic inflator (bv2_a05) score < 40", {
      score: inflator.score
    });
    assert(inflator.rank > 25, "Semantic inflator (bv2_a05) rank > 25", {
      rank: inflator.rank
    });
  }

  // ── ASSERTION D: Score clustering prevention ──────────────────────────────
  console.log("\n  [D] Score Clustering Prevention:");
  const allScores = ranking.map(c => c.score);
  const scoreStdDev = stdDev(allScores);
  assert(
    scoreStdDev > 8,
    `Score distribution not collapsed (stddev=${scoreStdDev.toFixed(2)} > 8)`,
    { stddev: scoreStdDev.toFixed(2) }
  );

  // Verify strong matches score significantly higher than weak matches
  const weakScores = weakMatches.map(cv => byId[cv.id]?.score ?? 0);
  const avgWeakScore = mean(weakScores);
  const scoreSeparation = avgStrongScore - avgWeakScore;
  assert(
    scoreSeparation > 15,
    `Strong matches score significantly above weak matches (gap=${scoreSeparation.toFixed(1)} > 15)`,
    { avgStrong: avgStrongScore.toFixed(1), avgWeak: avgWeakScore.toFixed(1), gap: scoreSeparation.toFixed(1) }
  );

  // ── ASSERTION E: Strong match rank positions ──────────────────────────────
  console.log("\n  [E] Strong Match Rank Positions:");
  let strongRankViolations = 0;
  for (const cv of strongMatches) {
    const result = byId[cv.id];
    if (!result) { strongRankViolations++; continue; }
    if (result.rank > 30) {
      console.error(`    [FAIL] Strong match ${cv.id} (${cv.name}) ranked at ${result.rank} (expected ≤ 30)`);
      strongRankViolations++;
    } else {
      console.log(`    [PASS] ${cv.id} (${cv.name}) rank=${result.rank} score=${result.score}`);
    }
  }
  assert(
    strongRankViolations === 0,
    `All strong matches rank ≤ 30 (violations=${strongRankViolations})`,
    { violations: strongRankViolations }
  );

  // ── ASSERTION F: Weak match rank positions ────────────────────────────────
  console.log("\n  [F] Weak Match Rank Positions:");
  let weakRankViolations = 0;
  for (const cv of weakMatches) {
    const result = byId[cv.id];
    if (!result) continue;
    if (result.rank <= 30) {
      console.error(`    [FAIL] Weak match ${cv.id} (${cv.name}) ranked at ${result.rank} (expected > 30)`);
      weakRankViolations++;
    } else {
      console.log(`    [PASS] ${cv.id} (${cv.name}) rank=${result.rank} score=${result.score}`);
    }
  }
  assert(
    weakRankViolations === 0,
    `All weak matches rank > 30 (violations=${weakRankViolations})`,
    { violations: weakRankViolations }
  );

  // ── ASSERTION G: Unrelated CV/job semantic similarity threshold ───────────
  console.log("\n  [G] Unrelated CV Semantic Similarity Threshold:");
  const unrelatedIds = [...weakMatches, ...crossDomain].map(cv => cv.id);
  let semanticViolations = 0;
  for (const id of unrelatedIds) {
    const c = byId[id];
    if (!c) continue;
    const embScore = c.debug?.rawEmbeddingScore ?? c.debug?.embeddingScore ?? c.projectMatchScore ?? 0;
    if (embScore > 35) {
      console.error(`    [FAIL] Unrelated CV ${id} has embeddingScore=${embScore} > 35`);
      semanticViolations++;
    }
  }
  assert(
    semanticViolations === 0,
    `Unrelated CVs embedding scores all ≤ 35 (violations=${semanticViolations})`,
    { violations: semanticViolations }
  );

  // ── ASSERTION H: Adversarial noise CVs do not crash pipeline ─────────────
  console.log("\n  [H] Adversarial Noise Resilience:");
  const allAdvIds = [
    ...advSpam.map(cv => cv.id),
    ...advEmpty.map(cv => cv.id),
    ...advNoise.map(cv => cv.id),
    ...advInflated.map(cv => cv.id),
  ];
  let noiseCrashViolations = 0;
  for (const id of allAdvIds) {
    const c = byId[id];
    if (!c) {
      console.error(`    [FAIL] Adversarial CV ${id} missing from ranking!`);
      noiseCrashViolations++;
    } else {
      const scoreValid = Number.isFinite(c.score) && c.score >= 0 && c.score <= 100;
      if (!scoreValid) {
        console.error(`    [FAIL] ${id} has invalid score: ${c.score}`);
        noiseCrashViolations++;
      } else {
        console.log(`    [PASS] ${id} processed successfully (rank=${c.rank}, score=${c.score})`);
      }
    }
  }
  assert(
    noiseCrashViolations === 0,
    `All adversarial CVs processed without crash (violations=${noiseCrashViolations})`
  );

  // ── ASSERTION I: Duplicate CV scoring consistency ─────────────────────────
  console.log("\n  [I] Duplicate CV Scoring Consistency:");
  const originalS01 = byId["bv2_s01"];
  const dupExact    = byId["bv2_d01"];
  const dupNear1    = byId["bv2_d02"];

  if (originalS01 && dupExact) {
    const delta = Math.abs(originalS01.score - dupExact.score);
    assert(delta <= 5, "Exact duplicate scores within ±5 of original", {
      original: originalS01.score, duplicate: dupExact.score, delta: delta.toFixed(1)
    });
  }
  if (originalS01 && dupNear1) {
    const delta = Math.abs(originalS01.score - dupNear1.score);
    assert(delta <= 12, "Near-duplicate scores within ±12 of original", {
      original: originalS01.score, nearDup: dupNear1.score, delta: delta.toFixed(1)
    });
  }

  // ── ASSERTION J: Mixed-domain batch — SWE dominates top for SWE job ────────
  console.log("\n  [J] Mixed-Domain Batch (SWE + HR + Healthcare):");
  const mixedIds = [
    "bv2_s01", "bv2_s02", "bv2_s03",
    "bv2_w01", "bv2_w02",
    "bv2_x01", "bv2_x02", "bv2_x03",
  ];
  const mixedDataset = fullDataset.filter(cv => mixedIds.includes(cv.id));
  const resMixed = await runRankingPipeline(buildPipelineInput(mixedDataset), deps);
  const mixedRanking = resMixed.ranking;

  const sweIds = new Set(["bv2_s01", "bv2_s02", "bv2_s03"]);
  const top3Mixed = mixedRanking.slice(0, 3).map(c => c.id);
  const sweInTop3 = top3Mixed.filter(id => sweIds.has(id)).length;
  assert(
    sweInTop3 >= 2,
    `SWE candidates dominate top-3 in mixed-domain batch (${sweInTop3}/3)`,
    { top3: top3Mixed.join(", "), sweInTop3 }
  );

  // ── ASSERTION K: Semantic never overpowers verified skills ────────────────
  console.log("\n  [K] Semantic vs Symbolic Scoring Balance:");
  let semanticDominanceViolations = 0;
  for (const cv of strongMatches) {
    const c = byId[cv.id];
    if (!c || c.score === 0) continue;
    const embScore = c.debug?.embeddingScore ?? c.projectMatchScore ?? 0;
    const skillScore = c.skillScore ?? 0;
    const ratio = c.score > 0 ? embScore / c.score : 0;
    if (ratio > 0.65) {
      console.error(`    [FAIL] ${cv.id}: embedding dominance ratio=${ratio.toFixed(2)} > 0.65`);
      semanticDominanceViolations++;
    }
  }
  assert(
    semanticDominanceViolations === 0,
    `Semantic score never dominates (>65%) strong match total scores`,
    { violations: semanticDominanceViolations }
  );

  // ── ASSERTION L: Fake Senior Architect does not get perfect score ─────────
  console.log("\n  [L] Fake/Inflated CV Containment:");
  const fakeSenior = byId["bv2_a04"];
  if (fakeSenior) {
    assert(fakeSenior.score < 90, "Fake Senior Architect score < 90", {
      score: fakeSenior.score
    });
    warn(fakeSenior.score < 75, "Fake Senior Architect score below 75 (soft target)", {
      score: fakeSenior.score
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 3: RANKING STABILITY (Determinism + Variance)
  // ══════════════════════════════════════════════════════════════════════════
  if (!NO_STABILITY) {
    console.log("\n" + "─".repeat(70));
    console.log("  SECTION 3: RANKING STABILITY (3 Runs)");
    console.log("─".repeat(70));

    console.log("\n  Run 1 (already complete)...");
    console.log("  Running Run 2...");
    const run2 = await runRankingPipeline(buildPipelineInput(scale50), deps);
    console.log("  Running Run 3...");
    const run3 = await runRankingPipeline(buildPipelineInput(scale50), deps);

    // Hard determinism check
    const r1json = JSON.stringify(res50.ranking.map(c => ({ id: c.id, score: c.score, rank: c.rank })));
    const r2json = JSON.stringify(run2.ranking.map(c => ({ id: c.id, score: c.score, rank: c.rank })));
    const r3json = JSON.stringify(run3.ranking.map(c => ({ id: c.id, score: c.score, rank: c.rank })));

    assert(r1json === r2json, "Run 1 and Run 2 are byte-identical");
    assert(r2json === r3json, "Run 2 and Run 3 are byte-identical");

    // Top-5 stability
    const top5_r1 = topK(res50.ranking, 5);
    const top5_r2 = topK(run2.ranking, 5);
    const top5_r3 = topK(run3.ranking, 5);
    assert(JSON.stringify(top5_r1) === JSON.stringify(top5_r2), "Top-5 stable: Run 1 = Run 2", {
      run1: top5_r1.join(","), run2: top5_r2.join(",")
    });
    assert(JSON.stringify(top5_r2) === JSON.stringify(top5_r3), "Top-5 stable: Run 2 = Run 3", {
      run2: top5_r2.join(","), run3: top5_r3.join(",")
    });

    // Per-candidate score variance across 3 runs
    const allRuns = [res50.ranking, run2.ranking, run3.ranking];
    const candidateIds = res50.ranking.map(c => c.id);
    let maxVarianceId = null;
    let maxVariance = 0;
    for (const id of candidateIds) {
      const scores = allRuns.map(run => run.find(c => c.id === id)?.score ?? 0);
      const sd = stdDev(scores);
      if (sd > maxVariance) { maxVariance = sd; maxVarianceId = id; }
    }
    assert(
      maxVariance < 2.0,
      `Per-candidate score variance bounded (max stddev=${maxVariance.toFixed(3)} < 2.0)`,
      { worstCandidate: maxVarianceId, maxStdDev: maxVariance.toFixed(3) }
    );

    // Rank flip rate
    let rankFlips = 0;
    for (let i = 1; i < allRuns.length; i++) {
      const prevOrder = allRuns[i - 1].map(c => c.id).join(",");
      const currOrder = allRuns[i].map(c => c.id).join(",");
      if (prevOrder !== currOrder) rankFlips++;
    }
    assert(rankFlips === 0, `Zero rank flips across 3 runs`, { rankFlips });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 4: NOISE STRESS
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + "─".repeat(70));
  console.log("  SECTION 4: NOISE STRESS (Adversarial-Only Batch)");
  console.log("─".repeat(70));

  const noiseOnlyDataset = [
    ...advSpam, ...advEmpty, ...advNoise, ...advInflated
  ];
  console.log(`\n  Running noise-only batch (${noiseOnlyDataset.length} CVs)...`);

  let noisePipelineCrashed = false;
  let noiseResult;
  try {
    noiseResult = await runRankingPipeline(buildPipelineInput(noiseOnlyDataset), deps);
  } catch (err) {
    noisePipelineCrashed = true;
    console.error(`  Pipeline crashed on adversarial input: ${err.message}`);
  }
  assert(!noisePipelineCrashed, "Pipeline does not crash on adversarial-only batch");

  if (!noisePipelineCrashed && noiseResult) {
    // Empty CV should still rank last in adversarial-only batch
    const noiseRanking = noiseResult.ranking;
    const emptyInNoise = noiseRanking.find(c => c.id === "bv2_a02");
    if (emptyInNoise) {
      assert(
        emptyInNoise.rank === noiseRanking.length || emptyInNoise.rank >= noiseRanking.length - 1,
        "Empty CV ranks last in adversarial-only batch",
        { rank: emptyInNoise.rank, total: noiseRanking.length }
      );
    }
    // All scores should be valid numbers
    const invalidScores = noiseRanking.filter(c => !Number.isFinite(c.score));
    assert(invalidScores.length === 0, "All adversarial CVs produce valid (finite) scores", {
      invalidCount: invalidScores.length
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ══════════════════════════════════════════════════════════════════════════
  printFinalReport(ranking);
}

function printFinalReport(ranking) {
  console.log("\n" + "═".repeat(70));
  console.log("  BENCHMARK SUMMARY");
  console.log("═".repeat(70));

  if (ranking) {
    console.log("\n  Top 10 candidates:");
    ranking.slice(0, 10).forEach((c, i) => {
      const mark = i < 5 ? "▶" : " ";
      console.log(`  ${mark} ${String(i + 1).padStart(2)}. [${c.id}] ${c.name.padEnd(30)} score=${c.score} role=${c.role}`);
    });
  }

  console.log(`\n  Assertions:  ${failures.length === 0 ? "ALL PASSED ✓" : `${failures.length} FAILED ✗`}`);
  console.log(`  Warnings:    ${warnings.length}`);

  if (failures.length > 0) {
    console.error("\n  FAILED ASSERTIONS:");
    failures.forEach((f, i) => {
      console.error(`    ${i + 1}. ${f.label}`);
    });
  }

  if (warnings.length > 0) {
    console.warn("\n  WARNINGS:");
    warnings.forEach((w, i) => {
      console.warn(`    ${i + 1}. ${w.label}`);
    });
  }

  console.log("\n" + "═".repeat(70));

  if (failures.length > 0) {
    console.error(`\n[BENCHMARK FAILED] ${failures.length} hard assertion(s) failed.\n`);
    process.exit(1);
  } else {
    console.log(`\n[BENCHMARK PASSED] All hard assertions passed.\n`);
    process.exit(0);
  }
}

// ─── ENTRYPOINT ───────────────────────────────────────────────────────────────
runFullBenchmark().catch(err => {
  console.error(JSON.stringify({ error: err.message, stack: err.stack }));
  process.exit(1);
});
