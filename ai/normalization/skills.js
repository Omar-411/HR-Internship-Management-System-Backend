import { getCanonicalSkill } from "../core/skillDictionary.js";

export const SKILL_DICTIONARY = {
  node: "node.js",
  nodejs: "node.js",
  "node js": "node.js",
  "node.js": "node.js",
  javascript: "javascript",
  js: "javascript",
  typescript: "typescript",
  ts: "typescript",
  react: "react",
  "react.js": "react",
  reactjs: "react",
  html: "html",
  html5: "html",
  css: "css",
  css3: "css",
  express: "express.js",
  "express.js": "express.js",
  mongodb: "mongodb",
  mongo: "mongodb",
  mysql: "mysql",
  postgresql: "postgres",
  postgres: "postgres",
  python: "python",
  java: "java",
  "c#": "c#",
  "c++": "c++",
  c: "c",
  mern: "mern stack",
  "mern stack": "mern stack",
  django: "django",
  flask: "flask",
  git: "git",
  github: "github",
  aws: "aws",
  azure: "azure",
  docker: "docker",
  kubernetes: "kubernetes",
  linux: "linux",
  "rest api": "rest apis",
  "rest apis": "rest apis",
  restapi: "rest apis",
  api: "apis",
  apis: "apis",
  oop: "object-oriented programming",
  "object-oriented programming": "object-oriented programming",
  middleware: "middleware",
  "rate limiting": "rate limiting",
  cors: "cors",
  crud: "crud operations",
  queries: "database queries",
  "ui/ux": "ui/ux design",
  "ui ux": "ui/ux design",
  "ui-ux": "ui/ux design",
  "responsive design": "responsive design",
  agile: "agile methodology",
  "agile methodology": "agile methodology",
  scrum: "scrum",
  "database management": "database management",
  database: "database management",
  sqlite: "sqlite",
  "vs code": "vs code",
  vscode: "vs code",
  "intellij idea": "intellij idea",
  intellij: "intellij idea",
  eclipse: "eclipse",
  netbeans: "netbeans",
  "tools & ides: git": "git",
  "web development": "web development",
  "full-stack applications": "full-stack development",
  "full stack": "full-stack development",
  "full-stack": "full-stack development",
  "problem-solving": "problem-solving",
  "problem solving": "problem-solving",
  problemsolving: "problem-solving",
  "qr code library": "qr code generation",
  "qr code": "qr code generation",
  creativity: "creativity",
  adaptability: "adaptability",
  communication: "communication",
  "calm under pressure": "calm under pressure",
  "independent yet cooperative": "independent yet cooperative",
};

export function flattenSkills(skills) {
  if (!skills) return [];
  let result = [];

  if (Array.isArray(skills)) {
    for (const item of skills) {
      if (Array.isArray(item)) {
        result.push(...item);
      } else if (typeof item === "object" && item !== null) {
        for (const key in item) {
          if (Array.isArray(item[key])) result.push(...item[key]);
          else if (typeof item[key] === "string") result.push(item[key]);
        }
      } else if (typeof item === "string") {
        result.push(item);
      }
    }
  } else if (typeof skills === "object" && skills !== null) {
    for (const key in skills) {
      if (Array.isArray(skills[key])) result.push(...skills[key]);
      else if (typeof skills[key] === "string") result.push(skills[key]);
    }
  } else if (typeof skills === "string") {
    result.push(skills);
  }

  return result;
}

export function normalizeSkills(skills) {
  const flatSkills = flattenSkills(skills);
  if (!Array.isArray(flatSkills) || flatSkills.length === 0) return [];

  const normalizedSkills = flatSkills
    .map((s) => s?.toString?.().trim())
    .filter(Boolean)
    .map((s) => getCanonicalSkill(s))
    .filter(Boolean);

  return [...new Set(normalizedSkills)].sort();
}

export function normalizeDomains(domains) {
  if (!Array.isArray(domains)) return [];

  const domainMap = {
    "computer science": "computer science",
    "software engineering": "software engineering",
    "web development": "web development",
    "full stack": "full-stack development",
    "full-stack": "full-stack development",
    backend: "backend development",
    "front-end": "frontend development",
    frontend: "frontend development",
    "mobile development": "mobile development",
    "data science": "data science",
    "machine learning": "machine learning",
    ai: "artificial intelligence",
    "artificial intelligence": "artificial intelligence",
  };

  return domains
    .filter(Boolean)
    .map((d) => d.toString().toLowerCase().trim())
    .filter((d) => d.length >= 2 && d.length <= 50)
    .map((d) => domainMap[d] || d)
    .filter((d, i, arr) => arr.indexOf(d) === i)
    .sort();
}

export function buildContextText(value) {
  const parts = [];

  function visit(item) {
    if (!item) return;
    if (typeof item === "string" || typeof item === "number") {
      const text = item.toString().trim();
      if (text) parts.push(text);
      return;
    }
    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }
    if (typeof item === "object") {
      Object.keys(item).sort().forEach((key) => visit(item[key]));
    }
  }

  visit(value);
  return [...new Set(parts.map((part) => part.toLowerCase()))].sort().join(" ");
}

export function tokenizeSkills(input) {
  if (!input) return [];
  
  // Convert array to single string joined by comma so that the split logic below works correctly
  const text = Array.isArray(input) ? input.join(", ") : input.toString();
  
  // 1. Remove parentheses characters but keep the contents!
  let cleaned = text.replace(/[()]/g, " ");

  // 2. Remove typical stopwords and filler phrases
  const stopPhrases = [
    "proficiency in", "knowledge of", "experience with", "familiarity with",
    "understanding of", "ability to", "working knowledge of", "one or more",
    "such as", "e.g.", "etc.", "e.g", "etc"
  ];
  
  for (const phrase of stopPhrases) {
    cleaned = cleaned.replace(new RegExp(`\\b${phrase}\\b`, "gi"), " ");
  }

  // 3. Split by common delimiters (comma, slash, semicolon, newline, plus "and", "or")
  const rawTokens = cleaned.split(/[,/;\n]|\band\b|\bor\b/gi);

  // 4. Normalize and canonicalize
  const extracted = rawTokens
    .map(token => token.trim().toLowerCase())
    .filter(token => token.length > 1) // filter out empty or 1-char junk
    .map(token => getCanonicalSkill(token) || token); // keep canonical or original cleaned word

  // 5. Flatten anything that might be multi-word if it isn't canonicalized, but wait
  // We want to keep it as tokenized as possible without breaking phrases like "machine learning".
  // Let's rely on getCanonicalSkill to catch valid phrases.

  return [...new Set(extracted)].sort();
}
