/**
 * Technical Filter rules for strict closed-world occupation import.
 */

export const TECH_KEYWORDS = [
  "developer", "engineer", "frontend", "backend", "fullstack", "software", "qa", 
  "devops", "ui", "ux", "mobile", "android", "ios", "ai", "machine learning", 
  "data engineer", "bi", "analytics", "cloud", "infrastructure", "database",
  "programmer", "architect", "scrum", "agile", "data scientist", "specialist"
];

export const EXCLUDED_DOMAINS = [
  "legal", "healthcare", "marketing", "social work", "teaching", "event management",
  "wedding planning", "transportation", "retail", "hospitality", "non-engineering operations",
  "nurse", "doctor", "chef", "food", "retail", "sales", "hospitality", "hotel"
];

/**
 * Checks if an ESCO occupation title matches the tech-only criteria.
 * @param {string} title - The preferred label/title of the occupation.
 * @returns {boolean} True if the title is technical and not in an excluded domain.
 */
export function isTechOccupation(title) {
  if (!title || typeof title !== "string") return false;
  const lowerTitle = title.toLowerCase();

  // Check hard exclusions
  const hasExcluded = EXCLUDED_DOMAINS.some(domain => lowerTitle.includes(domain));
  if (hasExcluded) return false;

  // Check strong keyword matches
  return TECH_KEYWORDS.some(keyword => lowerTitle.includes(keyword));
}
