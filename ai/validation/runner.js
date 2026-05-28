import fs from "fs";
import { calculateHybridScore } from "../core/scoringEngine.js";
import { getSkillOrOccupationEmbedding } from "../core/embeddingService.js";
import { internalRoles } from "../core/internalRoles.js";

async function runValidation() {
  console.log("🚀 Starting Closed-World Canonical Tech Role Validation Runner...");
  
  const benchmarksPath = "./validation/benchmarks.json";

  if (!fs.existsSync(benchmarksPath)) {
    console.error("❌ Benchmarks dataset not found at", benchmarksPath);
    process.exit(1);
  }

  const benchmarks = JSON.parse(fs.readFileSync(benchmarksPath, "utf8"));
  console.log(`Loaded ${benchmarks.length} benchmarks to match against ${internalRoles.length} internal roles.`);

  const deps = {
    getEmbedding: getSkillOrOccupationEmbedding
  };

  let totalReciprocalRank = 0;
  let totalPrecisionAt5 = 0;
  let totalRecallAt5 = 0;
  let totalBenchmarks = benchmarks.length;

  for (const bm of benchmarks) {
    console.log(`\nEvaluating Benchmark: "${bm.name}" (${bm.benchmarkId})`);
    
    const scoredList = [];
    for (const role of internalRoles) {
      try {
        const matchResult = await calculateHybridScore(bm.candidate, role, deps, true);
        scoredList.push({
          roleName: role.name,
          title: role.name,
          score: matchResult.score,
          breakdown: matchResult.breakdown,
          matchedCore: matchResult.matchedCore || [],
          matchedOptional: matchResult.matchedOptional || [],
          matchedExcluded: matchResult.matchedExcluded || [],
          penaltyApplied: matchResult.penaltyApplied || "None"
        });
      } catch (err) {
        // Skip on error
      }
    }

    // Sort descending by score, tie-break by role name alphabetically
    scoredList.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

    console.log("Top Recommended Roles:");
    scoredList.slice(0, 3).forEach((rec, i) => {
      console.log(` ${i + 1}. [${rec.score} pts] ${rec.title}`);
      console.log(`    └─ Component Contribution:`);
      console.log(`       - Skill Match Contribution: ${rec.breakdown.skillOverlap.contribution}% (Core Matches: ${rec.matchedCore.length}, Optional: ${rec.matchedOptional.length})`);
      console.log(`       - Embedding Contribution: ${rec.breakdown.embedding.contribution}% (Similarity: ${rec.breakdown.embedding.similarity.toFixed(4)})`);
      console.log(`       - Project Evidence: ${rec.breakdown.projectEvidence.contribution}%`);
      console.log(`       - Taxonomy: ${rec.breakdown.taxonomy.contribution}%`);
      console.log(`    └─ Match Adjustments:`);
      console.log(`       - Penalty Applied: ${rec.penaltyApplied}`);
      console.log(`    └─ Matched Core Skills: ${rec.matchedCore.length > 0 ? rec.matchedCore.join(", ") : "None"}`);
      console.log(`    └─ Matched Optional Skills: ${rec.matchedOptional.length > 0 ? rec.matchedOptional.join(", ") : "None"}`);
      console.log(`    └─ Matched Excluded Skills: ${rec.matchedExcluded.length > 0 ? rec.matchedExcluded.join(", ") : "None"}`);
    });

    const expected = bm.expectedOccupations || [];
    let reciprocalRank = 0;
    let hitsAt5 = 0;

    for (const exp of expected) {
      const rankIndex = scoredList.findIndex(item => item.title.toLowerCase() === exp.title.toLowerCase());
      const rank = rankIndex + 1;
      
      if (rank > 0) {
        const scoredObj = scoredList[rankIndex];
        console.log(`🎯 Expected Role "${exp.title}" was ranked #${rank} with score of ${scoredObj.score} pts.`);
        if (scoredObj.score < exp.minExpectedScore) {
          console.warn(`  ⚠️ Score ${scoredObj.score} is below the expected minimum of ${exp.minExpectedScore} pts.`);
        }
        
        if (reciprocalRank === 0) {
          reciprocalRank = 1 / rank;
        }
        if (rank <= 5) {
          hitsAt5++;
        }
      } else {
        console.error(`❌ Expected Role "${exp.title}" was NOT found in the recommendations list!`);
      }
    }

    totalReciprocalRank += reciprocalRank;
    totalPrecisionAt5 += hitsAt5 / 5;
    totalRecallAt5 += expected.length > 0 ? hitsAt5 / expected.length : 0;
  }

  const mrr = totalBenchmarks > 0 ? (totalReciprocalRank / totalBenchmarks).toFixed(3) : 0;
  const pAt5 = totalBenchmarks > 0 ? (totalPrecisionAt5 / totalBenchmarks).toFixed(3) : 0;
  const rAt5 = totalBenchmarks > 0 ? (totalRecallAt5 / totalBenchmarks).toFixed(3) : 0;

  console.log("\n==========================================");
  console.log("📊 AGGREGATE ACCURACY METRICS REPORT");
  console.log(`📚 Benchmarks Processed: ${totalBenchmarks}`);
  console.log(`🎯 Mean Reciprocal Rank (MRR): ${mrr}`);
  console.log(`🎯 Precision@5: ${pAt5}`);
  console.log(`🎯 Recall@5: ${rAt5}`);
  console.log("==========================================\n");

  const mrrVal = parseFloat(mrr);
  const pAt5Val = parseFloat(pAt5);

  let signalQuality = "LOW";
  if (mrrVal >= 0.8 && pAt5Val >= 0.5) {
    signalQuality = "HIGH";
  } else if (mrrVal >= 0.4) {
    signalQuality = "MEDIUM";
  }

  console.log(`🟢 EVALUATION COMPLETE — SIGNAL QUALITY ${signalQuality}`);
  process.exitCode = 0;
}

runValidation().catch(err => {
  console.error("❌ Validation runner crashed:", err);
  process.exitCode = 1;
});
