import assert from "assert";
import {
  clampScore,
  countSkillOccurrences,
  dampenFrequency,
  normalizeRoleSkillAlias,
  calibrateRoleScores,
} from "../../core/services/scoring.service.js";
import { validateCandidateSchema } from "../../validation/schema.js";

// Helper for test reporting
function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log("Starting CV Pipeline Regression & Stability Tests...\n");

// 1. Math Utility Tests
runTest("clampScore boundary and clamping checks", () => {
  assert.strictEqual(clampScore(105), 100);
  assert.strictEqual(clampScore(-5), 0);
  assert.strictEqual(clampScore(78.6), 79); // rounding check
  assert.strictEqual(clampScore(0), 0);
  assert.strictEqual(clampScore(100), 100);
});

runTest("countSkillOccurrences case insensitivity & boundary matching", () => {
  const context = "Candidate is proficient in React, Next.js, and Node.js. React is their favorite.".toLowerCase();
  assert.strictEqual(countSkillOccurrences(context, "React"), 2);
  assert.strictEqual(countSkillOccurrences(context, "next.js"), 1);
  assert.strictEqual(countSkillOccurrences(context, "Vue"), 0);
  assert.strictEqual(countSkillOccurrences(null, "React"), 0);
});

runTest("dampenFrequency logarithmic behavior", () => {
  assert.strictEqual(dampenFrequency(0), 0);
  assert.strictEqual(dampenFrequency(1), 1);
  // Logarithmic damping for count > 1
  const count2 = dampenFrequency(2);
  assert.ok(count2 > 1 && count2 < 2);
});

runTest("normalizeRoleSkillAlias normalization dictionary matching", () => {
  assert.strictEqual(normalizeRoleSkillAlias("node"), "nodejs");
  assert.strictEqual(normalizeRoleSkillAlias("Node.js"), "nodejs");
  assert.strictEqual(normalizeRoleSkillAlias("react.js"), "reactjs");
  assert.strictEqual(normalizeRoleSkillAlias("ReactJS"), "reactjs");
  assert.strictEqual(normalizeRoleSkillAlias("unknown-skill"), "unknown-skill");
});

// 2. Schema Validation Tests
runTest("validateCandidateSchema validation behavior", () => {
  const validCandidate = {
    name: "Hanen",
    technicalSkills: ["React", "Node.js"],
    languages: ["English"],
    domains: ["Computer Science"],
    softSkills: ["Communication"],
  };

  const validationValid = validateCandidateSchema(validCandidate);
  assert.strictEqual(validationValid.isValid, true);
  assert.strictEqual(validationValid.errors.length, 0);

  const missingName = { ...validCandidate, name: "" };
  assert.strictEqual(validateCandidateSchema(missingName).isValid, false);

  const missingSkills = { ...validCandidate, technicalSkills: [] };
  assert.strictEqual(validateCandidateSchema(missingSkills).isValid, false);
});

// 3. Scoring & Role Calibration Regression Checks
runTest("calibrateRoleScores stable weights and embedding caps", () => {
  const testCandidate = {
    candidateSkills: ["react", "nodejs", "javascript", "html", "css"],
    projectContext: "Developer built react pages and nodejs apis.",
    experienceContext: "Frontend experience in javascript and css.",
    embeddingScore: 0.80,
  };

  const result = calibrateRoleScores(testCandidate);

  // Check expected roles are in distribution
  assert.ok(Array.isArray(result.roleDistribution));
  assert.ok(result.roleDistribution.length > 0);

  // Ensure embedding contribution is within expected interval
  const primaryRole = result.primary;
  const breakdown = result.roleScoreBreakdown[primaryRole];
  assert.ok(breakdown.embeddingContribution >= 2 && breakdown.embeddingContribution <= 20);

  // Ensure total score is safely within bounds
  assert.ok(result.confidence >= 0 && result.confidence <= 100);
  assert.ok(breakdown.totalRoleScore >= 0 && breakdown.totalRoleScore <= 100);

  // Verify pure additive audit tracing
  const resultAudited = calibrateRoleScores({ ...testCandidate, audit: true });
  assert.strictEqual(resultAudited.primary, result.primary);
  assert.strictEqual(resultAudited.confidence, result.confidence);
  assert.ok(resultAudited.audit !== undefined);
  const auditPrimary = resultAudited.audit[primaryRole];
  assert.ok(auditPrimary.factorWeights !== undefined);
  assert.ok(auditPrimary.skillContribution.contribution !== undefined);
  assert.strictEqual(auditPrimary.afterScore, breakdown.totalRoleScore);
});

console.log("\nAll Regression Tests Passed Successfully!");
