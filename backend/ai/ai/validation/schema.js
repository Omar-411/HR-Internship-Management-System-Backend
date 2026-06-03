/**
 * Validates the extracted candidate object against the expected CV extraction schema.
 * @param {any} data - The parsed object from LLM output.
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export function validateCandidateSchema(data) {
  const errors = [];

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {
      isValid: false,
      errors: ["Root output must be a valid JSON object."]
    };
  }

  // Name check
  if (!data.name || typeof data.name !== "string" || data.name.trim() === "") {
    errors.push("Missing or invalid 'name' field.");
  } else {
    const lowerName = data.name.toLowerCase().trim();
    if (lowerName === "unknown" || lowerName === "candidate") {
      errors.push("'name' field cannot be generic or unknown.");
    }
  }

  // Helper to validate array of strings
  function checkStringArray(field, label) {
    if (!Object.prototype.hasOwnProperty.call(data, field)) {
      errors.push(`Missing field: '${field}'.`);
      return;
    }
    if (!Array.isArray(data[field])) {
      errors.push(`'${field}' must be an array.`);
      return;
    }
    const hasNonString = data[field].some(val => typeof val !== "string");
    if (hasNonString) {
      errors.push(`All elements in '${field}' must be strings.`);
    }
  }

  checkStringArray("technicalSkills", "Technical Skills");
  checkStringArray("languages", "Languages");
  checkStringArray("domains", "Domains");
  checkStringArray("softSkills", "Soft Skills");

  // Empty skills validation (crucial requirement)
  if (Array.isArray(data.technicalSkills) && data.technicalSkills.length === 0) {
    errors.push("Candidate must have at least one technical skill listed.");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
