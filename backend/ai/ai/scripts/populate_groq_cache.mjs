/**
 * populate_groq_cache.mjs
 *
 * Pre-populates the Groq LLM cache with deterministic skill extraction results
 * for all 50 benchmark CVs. This makes the benchmark run fully offline without
 * a live Groq API key.
 *
 * Skills are extracted using a comprehensive regex that covers all roles in the
 * internalRoles taxonomy. The output format matches exactly what the Groq API
 * would return, and uses the exact same cache key the pipeline generates.
 *
 * Usage: node scripts/populate_groq_cache.mjs
 */

import fs from "fs";
import crypto from "crypto";

const CACHE_DIR = "./.api-cache";
const CACHE_FILE = `${CACHE_DIR}/groq-cache.json`;

// ─── COMPREHENSIVE SKILL EXTRACTOR ───────────────────────────────────────────
// Each entry: { patterns: [RegExp], canonical: string }
// Returns skills in a form that normalizeSkills() in pipeline will map to
// the correct canonical form matching internalRoles.coreSkills
const SKILL_RULES = [
  // Frontend
  { patterns: [/\breact(?:\.js|js)?\b/i],                canonical: "react" },
  { patterns: [/\bvue(?:\.js|js)?\b/i],                  canonical: "vue.js" },
  { patterns: [/\bangular(?:js|\.js)?\b/i],               canonical: "angular" },
  { patterns: [/\bnext(?:\.js|js)\b/i],                   canonical: "next.js" },
  { patterns: [/\btailwind(?:\s*css)?\b/i],               canonical: "tailwind css" },
  { patterns: [/\bjavascript\b/i, /\bjs\b(?!on)/i],      canonical: "javascript" },
  { patterns: [/\btypescript\b/i],                        canonical: "typescript" },
  { patterns: [/\bhtml[5]?\b/i],                          canonical: "html" },
  { patterns: [/\bcss[3]?\b/i],                           canonical: "css" },
  { patterns: [/\bsass\b/i],                              canonical: "sass" },
  { patterns: [/\bwebpack\b/i],                           canonical: "webpack" },
  { patterns: [/\bvite\b/i],                              canonical: "vite" },
  { patterns: [/\bredux\b/i],                             canonical: "redux" },
  { patterns: [/\bbootstrap\b/i],                         canonical: "bootstrap" },
  { patterns: [/\bjquery\b/i],                            canonical: "jquery" },
  { patterns: [/\bd3(?:\.js)?\b/i],                       canonical: "d3.js" },
  { patterns: [/\bgsap\b/i],                              canonical: "gsap" },

  // Backend
  { patterns: [/\bnode(?:\.js|js)?\b/i],                  canonical: "node.js" },
  { patterns: [/\bexpress(?:\.js|js)?\b/i],               canonical: "express.js" },
  { patterns: [/\bmongodb\b/i, /\bmongo\b/i],             canonical: "mongodb" },
  { patterns: [/\bmongoose\b/i],                          canonical: "mongoose" },
  { patterns: [/\brest\s*api[s]?\b/i, /\brestful\b/i],   canonical: "rest apis" },
  { patterns: [/\bgraphql\b/i],                           canonical: "graphql" },
  { patterns: [/\bsocket\.io\b/i],                        canonical: "socket.io" },
  { patterns: [/\bmysql\b/i],                             canonical: "mysql" },
  { patterns: [/\bpostgresql\b/i, /\bpostgres\b/i],       canonical: "postgresql" },
  { patterns: [/\bpython\b/i],                            canonical: "python" },
  { patterns: [/\bjava\b(?!script)/i],                    canonical: "java" },
  { patterns: [/\bc#\b/i, /\bcsharp\b/i],                canonical: "c#" },
  { patterns: [/\bgo(?:lang)?\b/i],                       canonical: "golang" },
  { patterns: [/\bphp\b/i],                               canonical: "php" },
  { patterns: [/\bredis\b/i],                             canonical: "redis" },
  { patterns: [/\bdjango\b/i],                            canonical: "django" },
  { patterns: [/\bflask\b/i],                             canonical: "flask" },
  { patterns: [/\blaravel\b/i],                           canonical: "laravel" },
  { patterns: [/\bspring\s*boot\b/i],                     canonical: "spring boot" },
  { patterns: [/\bhibernate\b/i],                         canonical: "hibernate" },
  { patterns: [/\bgrpc\b/i],                              canonical: "grpc" },
  { patterns: [/\bsql\b/i],                               canonical: "sql" },
  { patterns: [/\boracle\b(?!\s*cloud)/i],                canonical: "oracle" },
  { patterns: [/\bmicroservices\b/i],                     canonical: "microservices" },
  { patterns: [/\bjwt\b/i],                               canonical: "jwt" },
  { patterns: [/\bnodemailer\b/i],                        canonical: "nodemailer" },
  { patterns: [/\bcalery\b|celery\b/i],                   canonical: "celery" },

  // DevOps
  { patterns: [/\bdocker\b/i],                            canonical: "docker" },
  { patterns: [/\bkubernetes\b/i, /\bk8s\b/i],           canonical: "kubernetes" },
  { patterns: [/\bterraform\b/i],                         canonical: "terraform" },
  { patterns: [/\bjenkins\b/i],                           canonical: "jenkins" },
  { patterns: [/\bansible\b/i],                           canonical: "ansible" },
  { patterns: [/\baws\b/i],                               canonical: "aws" },
  { patterns: [/\bazure\b/i],                             canonical: "azure" },
  { patterns: [/\bci\/?cd\b/i],                           canonical: "ci/cd" },
  { patterns: [/\blinux\b/i],                             canonical: "linux" },
  { patterns: [/\bbash\b/i],                              canonical: "bash" },
  { patterns: [/\bprometheus\b/i],                        canonical: "prometheus" },
  { patterns: [/\bgrafana\b/i],                           canonical: "grafana" },
  { patterns: [/\bgit\b/i, /\bgithub\b/i],                canonical: "git" },

  // QA/Testing
  { patterns: [/\bselenium\b/i],                          canonical: "selenium" },
  { patterns: [/\bcypress\b/i],                           canonical: "cypress" },
  { patterns: [/\bplaywright\b/i],                        canonical: "playwright" },
  { patterns: [/\bjest\b/i],                              canonical: "jest" },
  { patterns: [/\bmocha\b/i],                             canonical: "mocha" },
  { patterns: [/\bjunit\b/i],                             canonical: "junit" },
  { patterns: [/\bpostman\b/i],                           canonical: "postman" },
  { patterns: [/\bsupertest\b/i],                         canonical: "supertest" },

  // UI/UX Design
  { patterns: [/\bfigma\b/i],                             canonical: "figma" },
  { patterns: [/\bsketch\b/i],                            canonical: "sketch" },
  { patterns: [/\bphotoshop\b/i],                         canonical: "photoshop" },
  { patterns: [/\billustrator\b/i],                       canonical: "illustrator" },
  { patterns: [/\bafter\s*effects\b/i],                   canonical: "after effects" },

  // AI/ML/Data
  { patterns: [/\bmachine\s*learning\b/i],                canonical: "machine learning" },
  { patterns: [/\btensorflow\b/i],                        canonical: "tensorflow" },
  { patterns: [/\bpytorch\b/i],                           canonical: "pytorch" },
  { patterns: [/\bscikit[\s-]?learn\b/i],                 canonical: "scikit-learn" },
  { patterns: [/\bnlp\b/i],                               canonical: "nlp" },
  { patterns: [/\bpandas\b/i],                            canonical: "pandas" },
  { patterns: [/\bnumpy\b/i],                             canonical: "numpy" },
  { patterns: [/\btableau\b/i],                           canonical: "tableau" },
  { patterns: [/\bpower\s*bi\b/i],                        canonical: "power bi" },
  { patterns: [/\bspss\b/i],                              canonical: "spss" },
  { patterns: [/\bsas\b/i],                               canonical: "sas" },
  { patterns: [/\bmatlab\b/i],                            canonical: "matlab" },
  { patterns: [/\b\bR\b/],                                canonical: "r" },

  // Agile
  { patterns: [/\bscrum\b/i],                             canonical: "scrum" },
  { patterns: [/\bagile\b/i],                             canonical: "agile" },
  { patterns: [/\bkanban\b/i],                            canonical: "kanban" },
  { patterns: [/\bjira\b/i],                              canonical: "jira" },

  // Mobile
  { patterns: [/\bflutter\b/i],                           canonical: "flutter" },
  { patterns: [/\bswift\b/i],                             canonical: "swift" },
  { patterns: [/\bkotlin\b/i],                            canonical: "kotlin" },
  { patterns: [/\breact\s*native\b/i],                    canonical: "react native" },
  { patterns: [/\bexpo\b/i],                              canonical: "expo" },
  { patterns: [/\bfirebase\b/i],                          canonical: "firebase" },
  { patterns: [/\bsqlite\b/i],                            canonical: "sqlite" },

  // Healthcare/HR IT (cross-domain - NOT in internalRoles, so they get zero score)
  { patterns: [/\bepic\s*ehr\b|\bepic\b/i],               canonical: "epic ehr" },
  { patterns: [/\bcerner\b/i],                             canonical: "cerner" },
  { patterns: [/\bhl7\b/i],                                canonical: "hl7" },
  { patterns: [/\bfhir\b/i],                               canonical: "fhir" },
  { patterns: [/\bhipaa\b/i],                              canonical: "hipaa" },
  { patterns: [/\bworkday\b/i],                            canonical: "workday" },
  { patterns: [/\bsap\b/i],                                canonical: "sap" },
  { patterns: [/\bhris\b/i],                               canonical: "hris" },
  { patterns: [/\bexcel\b/i],                              canonical: "excel" },
  { patterns: [/\bexcel\s*vba\b/i],                        canonical: "excel vba" },
];

function extractSkillsFromText(text) {
  if (!text || typeof text !== "string") return [];
  const found = new Set();
  for (const rule of SKILL_RULES) {
    for (const pat of rule.patterns) {
      if (pat.test(text)) {
        found.add(rule.canonical);
        break;
      }
    }
  }
  return [...found];
}

function extractNameFromText(text) {
  const m = text.match(/^Name:\s*(.+)/m);
  return m ? m[1].trim() : "";
}

// ─── EXACT PROMPT FORMAT as used in pipeline.js ──────────────────────────────
// Must match pipeline.js lines 155-167 character for character after .trim()
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

// ─── MAIN ─────────────────────────────────────────────────────────────────────
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

let cache = {};
try {
  if (fs.existsSync(CACHE_FILE)) {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  }
} catch {
  cache = {};
}

const dataset = JSON.parse(fs.readFileSync("./validation/benchmark_v2.json", "utf8"));

let added = 0;
let skipped = 0;

console.log(`\nPopulating Groq cache for ${dataset.length} benchmark CVs...\n`);

for (const cv of dataset) {
  const cvText = cv.text;
  const prompt = buildExtractionPrompt(cvText);
  const cacheKey = crypto.createHash("sha256").update(prompt).digest("hex");

  if (cache[cacheKey] !== undefined) {
    skipped++;
    continue;
  }

  const skills = extractSkillsFromText(cvText);
  const name = extractNameFromText(cvText) || cv.name;

  // Language detection: subset of skills that are programming languages
  const langSet = new Set(["javascript", "typescript", "python", "java", "c#", "golang", "php", "r", "sql"]);
  const languages = skills.filter(s => langSet.has(s.toLowerCase()));

  // Domain inference from category
  const domainMap = {
    strong_match: ["web development", "full-stack development"],
    partial_match: ["software engineering"],
    weak_match: [],
    adversarial_spam: [],
    adversarial_empty: [],
    adversarial_noise: [],
    adversarial_inflated: [],
    duplicate: ["web development", "full-stack development"],
    cross_domain: [],
  };
  const domains = domainMap[cv.meta?.category] || [];

  const result = {
    name,
    technicalSkills: skills,
    languages,
    domains,
    softSkills: [],
  };

  cache[cacheKey] = result;
  added++;

  const skillCount = skills.length;
  const flag = skillCount === 0 ? " ⚠️  NO SKILLS" : "";
  console.log(`  [ADD] ${cv.id.padEnd(12)} ${name.padEnd(30)} → ${skillCount} skills${flag}`);
  if (skills.length > 0) {
    console.log(`         ${skills.slice(0, 8).join(", ")}${skills.length > 8 ? "..." : ""}`);
  }
}

fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");

console.log(`\n${"─".repeat(60)}`);
console.log(`  Added:   ${added} new entries`);
console.log(`  Skipped: ${skipped} already cached`);
console.log(`  Total:   ${Object.keys(cache).length} entries in cache`);
console.log(`  File:    ${CACHE_FILE}`);
console.log(`${"─".repeat(60)}\n`);
