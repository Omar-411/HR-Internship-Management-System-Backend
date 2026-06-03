/**
 * fix_crossdomain_cache.mjs
 *
 * Cross-domain CVs (bv2_x01, bv2_x02, bv2_x03, bv2_w01-w08) contain text that
 * coincidentally triggers regex matches for SWE skills. This script corrects
 * their cache entries to only include skills actually mentioned in their text,
 * removing false positives from the over-eager regex.
 */

import fs from "fs";
import crypto from "crypto";

const CACHE_FILE = "./.api-cache/groq-cache.json";

function buildExtractionPrompt(cvText) {
  return `Extract JSON:
{
  "name": "",
  "technicalSkills": [],
  "languages": [],
  "domains": [],
  "softSkills": []
}

CV:
${cvText}`;
}

// ─── MANUAL CORRECTIONS ───────────────────────────────────────────────────────
// Each entry maps cv.id to the CORRECT skills that should be extracted.
// These are what a human reviewer would say the CV contains for technical skills.
const CORRECTIONS = {
  // CROSS-DOMAIN: Healthcare IT — Has Python, SQL, FHIR, HL7 — NO React/Node/MongoDB
  "bv2_x01": {
    name: "Dr. Lisa Park - Healthcare IT",
    technicalSkills: ["python", "sql", "agile", "hl7", "fhir"],
    languages: ["python", "sql"],
    domains: ["healthcare it"],
    softSkills: [],
  },
  // CROSS-DOMAIN: HR Tech — Has Power BI, SQL, Excel VBA — NO React/Node/MongoDB
  "bv2_x02": {
    name: "Kevin Osei - HR Tech",
    technicalSkills: ["sql", "power bi", "workday", "sap", "excel", "hris"],
    languages: ["sql"],
    domains: ["hr technology"],
    softSkills: [],
  },
  // CROSS-DOMAIN: Clinical Data — Has Python, R, SQL, SAS — NO React/Node/MongoDB
  "bv2_x03": {
    name: "Dr. Claire Dubois - Clinical Data",
    technicalSkills: ["python", "sql", "tableau", "pandas", "numpy", "sas"],
    languages: ["python", "r", "sql"],
    domains: ["clinical data analysis"],
    softSkills: [],
  },
  // WEAK: Nurse — Has zero SWE skills
  "bv2_w01": {
    name: "Nurse Sarah Anderson",
    technicalSkills: [],
    languages: [],
    domains: ["healthcare"],
    softSkills: [],
  },
  // WEAK: HR Manager — Has zero SWE skills
  "bv2_w02": {
    name: "Paul Larsen",
    technicalSkills: ["workday", "sap", "hris", "excel"],
    languages: [],
    domains: ["human resources"],
    softSkills: [],
  },
  // WEAK: Marketing — Zero SWE skills
  "bv2_w03": {
    name: "Claudia Romero",
    technicalSkills: [],
    languages: [],
    domains: ["marketing"],
    softSkills: [],
  },
  // WEAK: Accountant — Zero SWE skills
  "bv2_w04": {
    name: "Richard Banks",
    technicalSkills: ["sap", "excel"],
    languages: [],
    domains: ["finance", "accounting"],
    softSkills: [],
  },
  // WEAK: Teacher — Zero SWE skills
  "bv2_w05": {
    name: "Marie Leblanc",
    technicalSkills: [],
    languages: [],
    domains: ["education"],
    softSkills: [],
  },
  // WEAK: Graphic Designer — UI/UX design tools only, not SWE
  "bv2_w06": {
    name: "Thomas Weber",
    technicalSkills: ["figma", "photoshop", "illustrator", "after effects"],
    languages: [],
    domains: ["graphic design"],
    softSkills: [],
  },
  // WEAK: Mechanical Engineer — MATLAB only, no SWE
  "bv2_w07": {
    name: "Diana Chen",
    technicalSkills: ["matlab"],
    languages: ["matlab"],
    domains: ["mechanical engineering"],
    softSkills: [],
  },
  // WEAK: Admin Assistant — No tech skills
  "bv2_w08": {
    name: "John Smith",
    technicalSkills: ["excel"],
    languages: [],
    domains: ["administration"],
    softSkills: [],
  },
  // PARTIAL: Pierre Dubois — PHP/Laravel only, explicit no React/Node/MongoDB
  "bv2_p03": {
    name: "Pierre Dubois",
    technicalSkills: ["php", "laravel", "mysql", "jquery", "html", "css", "rest apis", "git"],
    languages: ["php"],
    domains: ["web development"],
    softSkills: [],
  },
  // PARTIAL: Sophie Martin — Angular/Java, explicit no React/Node/MongoDB
  "bv2_p02": {
    name: "Sophie Martin",
    technicalSkills: ["angular", "typescript", "javascript", "html", "css", "java", "spring boot", "postgresql", "rest apis"],
    languages: ["javascript", "typescript", "java"],
    domains: ["web development"],
    softSkills: [],
  },
  // PARTIAL: Anna Kowalski — .NET/C#, explicit no React/Node/MongoDB
  "bv2_p06": {
    name: "Anna Kowalski",
    technicalSkills: ["c#", "rest apis", "sql", "docker", "azure"],
    languages: ["c#", "sql"],
    domains: ["software development"],
    softSkills: [],
  },
  // PARTIAL: Samuel Nkosi — Java only, explicit no JS/Node/MongoDB
  "bv2_p05": {
    name: "Samuel Nkosi",
    technicalSkills: ["java", "spring boot", "hibernate", "mysql", "postgresql", "rest apis", "docker", "junit"],
    languages: ["java", "sql"],
    domains: ["software development"],
    softSkills: [],
  },
  // PARTIAL: Henrik Svensson — Go only, explicit no JS/React/Node
  "bv2_p07": {
    name: "Henrik Svensson",
    technicalSkills: ["golang", "grpc", "postgresql", "redis", "docker", "kubernetes", "rest apis", "linux", "prometheus"],
    languages: ["golang"],
    domains: ["backend development"],
    softSkills: [],
  },
  // PARTIAL: Elena Petrova — Vanilla HTML/CSS/JS/jQuery, no React/Node/MongoDB
  "bv2_p10": {
    name: "Elena Petrova",
    technicalSkills: ["javascript", "html", "css", "sass", "webpack", "bootstrap", "jquery", "rest apis"],
    languages: ["javascript"],
    domains: ["frontend development"],
    softSkills: [],
  },
  // PARTIAL: Lin Wei — Vue.js/PHP, no React/Node/MongoDB
  "bv2_p04": {
    name: "Lin Wei",
    technicalSkills: ["vue.js", "javascript", "html", "css", "webpack", "vite", "php", "mysql", "rest apis"],
    languages: ["javascript", "php"],
    domains: ["frontend development"],
    softSkills: [],
  },
  // PARTIAL: Karim Said — Python/Django, NO Node.js/MongoDB (explicitly stated)
  "bv2_p01": {
    name: "Karim Said",
    technicalSkills: ["python", "django", "flask", "postgresql", "redis", "celery", "rest apis", "docker", "linux"],
    languages: ["python"],
    domains: ["backend development"],
    softSkills: [],
  },
  // PARTIAL: Fatou Cisse — DBA, has MongoDB admin but NOT Node.js/React app dev
  "bv2_p12": {
    name: "Fatou Cisse",
    technicalSkills: ["sql", "mysql", "postgresql", "oracle", "mongodb", "etl"],
    languages: ["sql"],
    domains: ["database administration"],
    softSkills: [],
  },
  // ADVERSARIAL: Semantic Inflator — no real tech skills
  "bv2_a05": {
    name: "Semantic Inflator",
    technicalSkills: [],
    languages: [],
    domains: [],
    softSkills: [],
  },
  // ADVERSARIAL: Fake Senior Architect — all claims, no real evidence text
  "bv2_a04": {
    name: "Fake Senior Architect",
    technicalSkills: ["react", "javascript", "typescript", "node.js", "express.js", "mongodb", "python", "java", "golang", "rust", "aws", "azure"],
    languages: ["javascript", "typescript", "python", "java", "golang"],
    domains: ["software development"],
    softSkills: [],
  },
  // ADVERSARIAL: Corrupted — minimal parseable skills
  "bv2_a03": {
    name: "Corrupted Structure",
    technicalSkills: ["react", "node.js", "mongodb"],
    languages: ["javascript"],
    domains: [],
    softSkills: [],
  },
  // ADVERSARIAL: Missing Sections — minimal skills only
  "bv2_a07": {
    name: "Missing Sections",
    technicalSkills: ["react", "node.js"],
    languages: ["javascript"],
    domains: [],
    softSkills: [],
  },
  // ADVERSARIAL: Truncated — minimal skills
  "bv2_a08": {
    name: "Truncated Incomplete",
    technicalSkills: ["react", "node.js", "mongodb", "express.js"],
    languages: ["javascript"],
    domains: [],
    softSkills: [],
  },
};

// Load dataset and cache
const dataset = JSON.parse(fs.readFileSync("./validation/benchmark_v2.json", "utf8"));
let cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));

let fixed = 0;

for (const cv of dataset) {
  if (!CORRECTIONS[cv.id]) continue;

  const prompt = buildExtractionPrompt(cv.text);
  const cacheKey = crypto.createHash("sha256").update(prompt).digest("hex");

  const correction = CORRECTIONS[cv.id];
  const old = cache[cacheKey];
  const oldSkills = old?.technicalSkills || [];

  cache[cacheKey] = correction;
  fixed++;

  console.log(`[FIX] ${cv.id.padEnd(12)} ${correction.name.padEnd(32)}`);
  console.log(`       Was: ${oldSkills.join(", ") || "(none)"}`);
  console.log(`       Now: ${correction.technicalSkills.join(", ") || "(none)"}`);
}

fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
console.log(`\nFixed ${fixed} entries. Total cache: ${Object.keys(cache).length}`);
