/**
 * debug_yusuf.mjs — diagnose why bv2_s12 (Yusuf Celik) is ranked 32.
 * Prints scores and rank of every candidate near him, with audit breakdowns.
 */
import fs from "fs";
import dotenv from "dotenv";
import { runRankingPipeline } from "../core/pipeline.js";
import { getEmbedding, cosineSimilarity } from "../core/services/embedding.service.js";
import { getValidatedCommentary, getChatCompletion } from "../core/services/llm.service.js";
import { validateCandidateSchema } from "../validation/schema.js";
import { normalizeSkills, normalizeDomains, buildContextText } from "../normalization/skills.js";
import { deepCopy, deepFreeze, stableCandidateFingerprint } from "../normalization/fingerprint.js";
import {
  calibrateRoleScores,
  countSkillOccurrences,
  dampenFrequency,
  clampScore,
} from "../core/services/scoring.service.js";

dotenv.config();

process.env.ENABLE_GROQ_CACHE = "true";
process.env.ENABLE_EMBEDDING_CACHE = "true";

const deps = {
  getEmbedding,
  getValidatedCommentary: async () => JSON.stringify({ ranking: [] }),
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

const dataset = JSON.parse(fs.readFileSync("./validation/benchmark_v2.json", "utf8"));

const BENCHMARK_PROJECT = {
  name: "Modern Web Platform",
  sector: "Technology",
  description: "A full-stack web application for enterprise customers using React, Node.js, Express.js, and MongoDB. Requires real-time capabilities and scalable REST APIs.",
};
const BENCHMARK_REQUIRED  = ["react", "node.js", "mongodb"];
const BENCHMARK_PREFERRED = ["express.js", "javascript", "typescript", "docker"];
const BENCHMARK_ROLES     = ["Frontend Developer", "Backend Engineer", "Fullstack Developer"];

const pipelineInput = {
  cvs: dataset.map(cv => ({ id: cv.id, name: cv.name, text: cv.text })),
  project: BENCHMARK_PROJECT,
  REQUIRED_TECHNOLOGIES: BENCHMARK_REQUIRED,
  PREFERRED_TECHNOLOGIES: BENCHMARK_PREFERRED,
  ROLE_TYPES: BENCHMARK_ROLES,
  options: { audit: true },
};

const { ranking } = await runRankingPipeline(pipelineInput, deps);

// Print ranks 25-40 with scores
console.log('\n=== RANKS 25-40 DEBUG ===\n');
const slice = ranking.slice(24, 40);
for (const c of slice) {
  const flag = c.id === 'bv2_s12' ? ' ◄ YUSUF' : '';
  console.log(`Rank ${(ranking.indexOf(c) + 1).toString().padStart(2)} | ${c.id.padEnd(12)} | score=${String(c.score).padStart(4)} | role=${c.role} | skills=${(c.technicalSkills||[]).join(', ')}${flag}`);
}

// Detailed breakdown for Yusuf
const yusuf = ranking.find(c => c.id === 'bv2_s12');
if (yusuf) {
  console.log('\n=== YUSUF DETAILED BREAKDOWN ===\n');
  console.log('Canonical skills:', yusuf.technicalSkills);
  console.log('Matched role:', yusuf.role);
  console.log('Score:', yusuf.score);
  if (yusuf.roleDistribution) {
    for (const r of yusuf.roleDistribution.sort((a,b)=>b.score-a.score).slice(0,5)) {
      console.log(`  ${r.role.padEnd(25)} score=${r.score}`);
    }
  }
  if (yusuf.audit) {
    for (const [role, data] of Object.entries(yusuf.audit)) {
      if (data.afterScore > 10 || data.penaltyApplied !== "None") {
        console.log(`Role: ${role}`);
        console.log(`  penaltyApplied: ${data.penaltyApplied}`);
        console.log(`  boostApplied: ${data.boostApplied}`);
        console.log(`  lockApplied: ${data.lockApplied}`);
        console.log(`  skillContribution:`, data.skillContribution);
        console.log(`  embeddingContribution:`, data.embeddingContribution);
        console.log(`  beforeScore: ${data.beforeScore} | afterScore: ${data.afterScore}`);
      }
    }
  }
}
