import { internalRoles } from "../internalRoles.js";

// Official display names for technology tokens.
// Keys are lowercase/normalised forms; values are the correct casing to use in prose.
const TECH_CASING_MAP = {
  // JavaScript ecosystem
  "javascript": "JavaScript",
  "typescript": "TypeScript",
  "node.js": "Node.js",
  "nodejs": "Node.js",
  "react": "React",
  "react native": "React Native",
  "reactnative": "React Native",
  "next.js": "Next.js",
  "nextjs": "Next.js",
  "vue.js": "Vue.js",
  "vuejs": "Vue.js",
  "angular": "Angular",
  "svelte": "Svelte",
  "express": "Express",
  "express.js": "Express.js",
  // Python
  "python": "Python",
  "django": "Django",
  "flask": "Flask",
  "fastapi": "FastAPI",
  // Mobile
  "swift": "Swift",
  "kotlin": "Kotlin",
  "flutter": "Flutter",
  "dart": "Dart",
  // Databases
  "postgresql": "PostgreSQL",
  "postgres": "PostgreSQL",
  "mysql": "MySQL",
  "mongodb": "MongoDB",
  "redis": "Redis",
  "sqlite": "SQLite",
  "firebase": "Firebase",
  "dynamodb": "DynamoDB",
  "cassandra": "Cassandra",
  "elasticsearch": "Elasticsearch",
  // Cloud & DevOps
  "aws": "AWS",
  "gcp": "GCP",
  "azure": "Azure",
  "docker": "Docker",
  "kubernetes": "Kubernetes",
  "terraform": "Terraform",
  "ansible": "Ansible",
  "jenkins": "Jenkins",
  "github actions": "GitHub Actions",
  "ci/cd": "CI/CD",
  // Real-time / Messaging
  "socket.io": "Socket.io",
  "websocket": "WebSocket",
  "websockets": "WebSockets",
  "mqtt": "MQTT",
  "kafka": "Kafka",
  "rabbitmq": "RabbitMQ",
  // AI / ML
  "tensorflow": "TensorFlow",
  "pytorch": "PyTorch",
  "scikit-learn": "scikit-learn",
  "openai": "OpenAI",
  "langchain": "LangChain",
  // Other
  "graphql": "GraphQL",
  "rest": "REST",
  "grpc": "gRPC",
  "html": "HTML",
  "css": "CSS",
  "sass": "Sass",
  "tailwind": "Tailwind CSS",
  "tailwindcss": "Tailwind CSS",
  "git": "Git",
  "linux": "Linux",
  "nginx": "Nginx",
  "stripe": "Stripe",
  "twilio": "Twilio",
  "mapbox": "Mapbox",
  "google maps": "Google Maps",
  "jwt": "JWT",
  "oauth": "OAuth",
};

/**
 * Returns the official display name for a technology string.
 * Falls back to the original string if no mapping is found.
 */
function applyTechCasing(name) {
  if (!name) return name;
  const key = name.trim().toLowerCase();
  return TECH_CASING_MAP[key] || name;
}

function capitalize(text) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function resolveRoleAlias(roleName) {
  if (!roleName) return roleName;
  const lower = roleName.trim().toLowerCase();
  for (const role of internalRoles) {
    if (role.name.toLowerCase() === lower) return role.name;
    if (role.aliases && role.aliases.some(a => a.toLowerCase() === lower)) return role.name;
  }
  return roleName;
}

/**
 * Formats a list of technology names with correct official casing.
 */
function formatList(items, limit = 4) {
  const values = [...new Set((items || []).filter(Boolean))]
    .map(applyTechCasing)
    .slice(0, limit);
  if (values.length <= 1) return values[0] || "";
  if (values.length === 2) return values.join(" and ");
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function firstName(fullName = "This candidate") {
  return String(fullName).trim().split(/\s+/)[0] || "This candidate";
}

function candidateName(userProfile, candidate) {
  return userProfile?.fullName || candidate?.name || "This candidate";
}

function stripTrailingPeriod(text) {
  return String(text || "").trim().replace(/\.+$/, "");
}

function describeRoleFit({ name, selectedRole, matchedTech, matchedRoleCore, currentPosition }) {
  const evidence = matchedTech.length > 0 ? matchedTech : matchedRoleCore;

  if (evidence.length > 0) {
    const techList = formatList(evidence);
    const positionContext = currentPosition ? `, backed by hands-on ${currentPosition} experience` : "";
    return `Strong fit for ${selectedRole} — brings solid hands-on experience with ${techList}${positionContext}.`;
  }

  return `Closest available ${selectedRole} candidate, though key project technologies aren't clearly evidenced in the CV.`;
}

function describeGap({ name, missingRequiredTech, missingTech, unavailable }) {
  if (unavailable) {
    return `Currently marked unavailable — confirm capacity before committing to this assignment.`;
  }
  if (missingRequiredTech.length > 0) {
    return `May need onboarding time for ${formatList(missingRequiredTech)} before contributing independently on critical deliverables.`;
  }
  if (missingTech.length > 0) {
    return `Some gaps in ${formatList(missingTech)} — worth a brief technical screen before finalising.`;
  }
  return "";
}

function roleScoreFor(candidate, roleName) {
  const canonical = resolveRoleAlias(roleName);
  return (candidate.roleDistribution || []).find((item) => item.role === canonical)?.score ?? null;
}

export function selectProjectRole(candidate, rolesNeeded = []) {
  const availableRoles = rolesNeeded.length > 0
    ? rolesNeeded
    : (candidate.roleDistribution || []).map((item) => item.role);

  let selectedRole = candidate.predictedRole || candidate.role;
  let selectedScore = candidate.score || 0;

  for (const role of availableRoles) {
    const score = roleScoreFor(candidate, role);
    if (score !== null && score > selectedScore) {
      selectedRole = role;
      selectedScore = score;
    }
  }

  if (rolesNeeded.length > 0) {
    const bestNeeded = rolesNeeded
      .map((role) => ({ role, score: roleScoreFor(candidate, role) }))
      .filter((item) => item.score !== null)
      .sort((a, b) => b.score - a.score)[0];

    if (bestNeeded) {
      selectedRole = bestNeeded.role;
      selectedScore = bestNeeded.score;
    }
  }

  return {
    selectedRole,
    selectedRoleScore: Math.max(0, Math.min(100, Math.round(selectedScore))),
  };
}

export function buildCandidateDecision({ candidate, userProfile, projectProfile, selectedRole, selectedRoleScore }) {
  const displayName = candidateName(userProfile, candidate);
  const shortName = firstName(displayName);
  const matchedTech = candidate.matchedSkills || [];
  const missingTech = candidate.missingSkills || [];
  const requiredTech = projectProfile.requiredTech || [];
  const canonicalRole = resolveRoleAlias(selectedRole);
  const roleProfile = internalRoles.find((role) => role.name === canonicalRole);
  const selectedRoleCoreSkills = roleProfile?.coreSkills || [];
  const matchedRoleCore = selectedRoleCoreSkills.filter((skill) => {
    const skills = candidate.technicalSkills || [];
    return skills.includes(skill);
  });

  const projectTechCoverage = requiredTech.length === 0
    ? 1
    : requiredTech.filter((skill) => matchedTech.includes(skill)).length / requiredTech.length;
  const availabilityPenalty = userProfile?.isAvailable === false ? 25 : 0;
  const compatibilityScore = Math.max(
    0,
    Math.min(100, Math.round((selectedRoleScore * 0.7) + (projectTechCoverage * 30) - availabilityPenalty))
  );

  let finalDecision = "Not recommended";
  if (!userProfile?.isAvailable) finalDecision = "Unavailable";
  else if (compatibilityScore >= 70) finalDecision = "Recommended";
  else if (compatibilityScore >= 45) finalDecision = "Consider with validation";

  // Collect the tech names already covered by the first bullet so we can
  // avoid repeating them as bare token bullets below.
  const techAlreadyCovered = new Set(
    matchedTech.slice(0, 3).map((s) => s.trim().toLowerCase())
  );

  const strengths = [];
  if (matchedTech.length > 0) {
    strengths.push(`Practical ${formatList(matchedTech.slice(0, 3))} experience directly applicable to this project's core delivery needs.`);
  }
  if (matchedRoleCore.length > 0 && matchedRoleCore.some((s) => !matchedTech.includes(s))) {
    const coreExtra = matchedRoleCore.filter((s) => !matchedTech.includes(s));
    strengths.push(`${selectedRole} fundamentals covered — ${formatList(coreExtra)} align with the role's day-to-day requirements.`);
  }
  for (const strength of candidate.strengths || []) {
    if (strengths.length >= 3) break;
    const cleaned = String(strength || "").trim();
    if (!cleaned) continue;
    // Skip bare tech token bullets: single words (or compound slugs with no
    // spaces/punctuation beyond hyphens) that are already covered by the
    // first bullet or are too short to add new information.
    const isBareToken = /^[\w.\-+#]+$/.test(cleaned) && cleaned.length < 25;
    if (isBareToken && techAlreadyCovered.has(cleaned.toLowerCase())) continue;
    // Also skip standalone tech tokens that aren't full sentences — they
    // provide no additional context a hiring manager can act on.
    if (isBareToken && !cleaned.includes(" ")) continue;
    strengths.push(cleaned);
  }

  const weaknesses = [];
  const missingRequiredTech = requiredTech.filter((skill) => !matchedTech.includes(skill));
  // Consolidate to a single, non-redundant risk sentence — the most impactful gap, stated once.
  if (userProfile?.isAvailable === false) {
    weaknesses.push(`Currently unavailable — capacity must be confirmed before planning this assignment.`);
  } else if (missingRequiredTech.length > 0) {
    // Priority: gaps in skills explicitly required by the project
    weaknesses.push(`Will likely need ramp-up time on ${formatList(missingRequiredTech.slice(0, 3))} before contributing independently on the most critical deliverables.`);
  } else if (missingTech.length > 0) {
    // Secondary: broader role-skill gaps not in the required list
    weaknesses.push(`Some gaps in ${formatList(missingTech.slice(0, 3))} — worth a brief technical screen before finalising the assignment.`);
  }

  const fitSentence = describeRoleFit({
    name: shortName,
    selectedRole,
    matchedTech,
    matchedRoleCore,
    currentPosition: userProfile?.currentPosition,
  });
  const gapSentence = describeGap({
    name: shortName,
    missingRequiredTech,
    missingTech,
    unavailable: userProfile?.isAvailable === false,
  });
  const decisionReasonParts = [
    fitSentence,
    gapSentence || `No major gaps identified — profile aligns well with the core ${selectedRole} requirements.`,
  ];

  const roleJustification = matchedRoleCore.length > 0
    ? `${selectedRole} is the best-fit role — background covers ${formatList(matchedRoleCore)}, which are central to this position.`
    : `${selectedRole} is the closest role match based on the project requirements and available CV evidence.`;

  return {
    compatibilityScore,
    projectCompatibility: compatibilityScore >= 75 ? "Strong fit" : compatibilityScore >= 50 ? "Partial fit" : "Weak fit",
    finalDecision,
    decisionReason: decisionReasonParts.filter(Boolean).join(" "),
    roleJustification,
    strengths: strengths.slice(0, 3).map((item) => item.trim()).filter(Boolean),
    weaknesses: weaknesses.slice(0, 3),
  };
}

/**
 * Produces a plain-language justification for why a candidate was assigned to a role.
 * Deliberately avoids all internal metric language (embedding scores, pipeline strings, etc.).
 * Always constructs a natural sentence from observable facts: name, tech, position, project.
 */
export function buildRoleAssignmentExplanation({ role, candidate, projectProfile }) {
  const name = firstName(candidate.fullName || candidate.candidateName || candidate.name);
  const currentPosition = candidate.currentPosition
    ? ` (currently ${candidate.currentPosition})`
    : "";
  const projectName = projectProfile.name || "this project";

  // Prefer tech skills the candidate has that are directly required by the project.
  const matchedTech = candidate.matchedTech || candidate.matchedSkills || [];
  const requiredTech = projectProfile.requiredTech || [];
  const directProjectTech = requiredTech.filter((tech) =>
    matchedTech.some((m) => m.toLowerCase() === tech.toLowerCase())
  );
  const roleEvidence = directProjectTech.length > 0 ? directProjectTech : matchedTech;

  if (roleEvidence.length > 0) {
    return `${name}${currentPosition} has hands-on ${formatList(roleEvidence.slice(0, 3))} experience, making them the strongest ${role} fit in the pool for ${projectName}.`;
  }

  // Fallback: no direct tech match, but still the best available candidate.
  return `${name}${currentPosition} is the closest ${role} match available — the supervisor should validate technical fit before confirming the assignment on ${projectName}.`;
}
