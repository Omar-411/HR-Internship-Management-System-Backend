/**
 * Normalizer module for sanitizing and formatting ESCO CSV structures.
 */

/**
 * Extracts a short unique ID (UUID or similar part) from a full URI.
 * E.g., http://data.europa.eu/esco/skill/0005c151-5b5a-4a66-8aac-60e734beb1ab -> 0005c151-5b5a-4a66-8aac-60e734beb1ab
 * If the URI doesn't contain a slash, returns the URI itself.
 * @param {string} uri - Full URI or ID string.
 * @returns {string} Short ID.
 */
export function extractIdFromUri(uri) {
  if (!uri || typeof uri !== "string") return "";
  const lastSlashIndex = uri.lastIndexOf("/");
  if (lastSlashIndex === -1) return uri.trim();
  return uri.slice(lastSlashIndex + 1).trim();
}

/**
 * Parses a multi-line, potentially quoted string (e.g. altLabels from CSV)
 * into a clean, unique array of string labels.
 * @param {string} rawLabels - Raw multi-line string.
 * @returns {Array<string>} Array of cleaned labels.
 */
export function parseAltLabels(rawLabels) {
  if (!rawLabels || typeof rawLabels !== "string") return [];
  
  const parsed = rawLabels
    .split(/\r?\n/)
    .map(label => {
      // Remove double quotes and extra whitespace
      return label.replace(/"/g, "").trim();
    })
    .filter(label => label.length > 0);

  return [...new Set(parsed)];
}

/**
 * Deduplicates and cleans an array of strings.
 * @param {Array<string>} arr - Array to deduplicate.
 * @returns {Array<string>} Deduplicated array.
 */
export function deduplicateArray(arr) {
  if (!Array.isArray(arr)) return [];
  const cleaned = arr
    .map(val => (val || "").toString().trim())
    .filter(val => val.length > 0);
  return [...new Set(cleaned)];
}

/**
 * Normalizes text for matching by converting to lowercase, removing punctuation,
 * and normalizing spaces.
 * @param {string} text - Raw text string.
 * @returns {string} Normalized text string.
 */
export function normalizeText(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Sanitizes descriptions by removing extra whitespace.
 * @param {string} text - Raw description text.
 * @returns {string} Sanitized description text.
 */
export function sanitizeDescription(text) {
  if (!text || typeof text !== "string") return "";
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Maps common raw skill names and phrases to unified canonical terms.
 * Ensures React, React.js, ReactJS mapping doesn't fragment.
 * @param {string} name - Raw skill name.
 * @returns {string} Unified alias.
 */
export function unifySkillAlias(name) {
  if (!name || typeof name !== "string") return "";
  const norm = name.toLowerCase().trim();
  
  if (norm.includes("react")) return "reactjs";
  if (norm.includes("node") && !norm.includes("node of")) return "nodejs";
  if (norm.includes("express")) return "expressjs";
  if (norm.includes("rest api") || norm.includes("restful api") || norm === "api") return "restapi";
  if (norm.includes("mongodb") || norm === "mongo") return "mongodb";
  if (norm === "javascript" || norm === "js" || norm.includes("javascript")) return "javascript";
  if (norm === "html5" || norm === "html") return "html";
  if (norm === "css3" || norm === "css") return "css";
  if (norm.includes("tailwind")) return "tailwindcss";
  
  return norm;
}

/**
 * Normalizes a skill name for robust semantic and string comparison.
 * Unifies separators (e.g. node.js -> nodejs, tailwind-css -> tailwindcss, react.js -> reactjs).
 * Removes all whitespace to unify multi-word phrases.
 * @param {string} name - Raw skill name.
 * @returns {string} Normalized unified skill name.
 */
export function normalizeSkillName(name) {
  if (!name || typeof name !== "string") return "";
  const unified = unifySkillAlias(name);
  return unified
    .replace(/[.\-_]/g, "") // Unify separators
    .replace(/\s+/g, "");    // Remove punctuation inconsistencies and whitespace
}

/**
 * Calculates a match score between a candidate skill name and a target skill name/altLabels.
 * Returns { matched: boolean, score: number }
 * - Exact Match: 1.0
 * - AltLabel Match: 0.8
 * - Fuzzy Match (Token/Jaccard overlap): >= 0.5
 * @param {string} candidateSkill - The candidate's skill name.
 * @param {string} targetLabel - Preferred label of target skill.
 * @param {Array<string>} targetAltLabels - Alt labels of target skill.
 * @returns {object} { matched: boolean, score: number }
 */
export function fuzzyMatchSkills(candidateSkill, targetLabel, targetAltLabels = []) {
  const normCand = normalizeSkillName(candidateSkill);
  const normTarget = normalizeSkillName(targetLabel);

  if (!normCand || !normTarget) {
    return { matched: false, score: 0.0 };
  }

  // 1. Exact Match on preferred label
  if (normCand === normTarget) {
    return { matched: true, score: 1.0 };
  }

  // 2. Exact match on any alt label
  for (const alt of targetAltLabels) {
    const normAlt = normalizeSkillName(alt);
    if (normCand === normAlt) {
      return { matched: true, score: 0.8 };
    }
  }

  // 3. Substring match (min length of 5 required to prevent false positives on short unified aliases like reactjs/nodejs/api)
  if (normCand.length >= 5 && normTarget.length >= 5) {
    if (normTarget.includes(normCand) || normCand.includes(normTarget)) {
      return { matched: true, score: 0.7 };
    }
  }

  for (const alt of targetAltLabels) {
    const normAlt = normalizeSkillName(alt);
    if (normCand.length >= 5 && normAlt.length >= 5) {
      if (normAlt.includes(normCand) || normCand.includes(normAlt)) {
        return { matched: true, score: 0.6 };
      }
    }
  }

  // 4. Token Overlap (Jaccard similarity)
  const candTokens = candidateSkill.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const targetTokens = targetLabel.toLowerCase().split(/\s+/).filter(t => t.length > 2);

  if (candTokens.length > 0 && targetTokens.length > 0) {
    const intersection = candTokens.filter(t => targetTokens.includes(t));
    const union = new Set([...candTokens, ...targetTokens]);
    const jaccard = intersection.length / union.size;

    if (jaccard >= 0.4) {
      return { matched: true, score: Math.max(0.5, parseFloat(jaccard.toFixed(2))) };
    }
  }

  return { matched: false, score: 0.0 };
}

