import crypto from "crypto";

export function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function deepFreeze(obj) {
  if (!obj || typeof obj !== "object" || Object.isFrozen(obj)) return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    deepFreeze(obj[key]);
  }
  return obj;
}

export function canonicalStringList(values) {
  const list = Array.isArray(values) ? values : [values].filter(Boolean);
  return [...new Set(
    list
      .map((value) => value?.toString?.().trim().toLowerCase())
      .filter(Boolean)
  )].sort();
}

export function stableCandidateFingerprint(candidate) {
  const payload = JSON.stringify({
    name: (candidate.name || "").toString().trim().toLowerCase(),
    technicalSkills: canonicalStringList(candidate.technicalSkills),
    domains: canonicalStringList(candidate.domains),
  });

  return crypto.createHash("sha256").update(payload).digest("hex");
}
