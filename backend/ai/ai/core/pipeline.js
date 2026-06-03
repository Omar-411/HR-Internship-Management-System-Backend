import { internalRoles } from "./internalRoles.js";
import { assignDomain } from "./domainTaxonomy.js";
import {
  adjacencyReorderConfig,
  mismatchPenaltyConfig,
  semanticScoringConfig,
} from "../config/scoring.config.js";

const debugPipeline = (...args) => {
  if (process.env.DEBUG_PIPELINE === "true") console.log(...args);
};

const warnPipeline = (...args) => {
  if (process.env.DEBUG_PIPELINE === "true") console.warn(...args);
};
/**
 * PURE Ranking Pipeline Engine
 * 100% pure function, no console.logs, no file reads, no direct API calls.
 * 
 * @param {object} input - CVs, project context, skills, and configuration options.
 * @param {object} deps - Injected dependencies (LLM, embedder, validators, normalizers, math utilities).
 * @returns {Promise<object>} Final structured candidate ranking and summary results.
 */
export async function runRankingPipeline(input, deps) {
  const {
    cvs,
    job = null,
    project: legacyProject = { name: "Default Project", description: "", sector: "" },
    REQUIRED_TECHNOLOGIES: legacyRequired = [],
    PREFERRED_TECHNOLOGIES: legacyPreferred = [],
    ROLE_TYPES: legacyRoles = [],
    options = {}
  } = input;

  const project = job ? { name: job.roleTitle || "Unknown Role", description: job.rawDescription || "", sector: job.domain || "" } : legacyProject;
  const REQUIRED_TECHNOLOGIES = job && Array.isArray(job.requiredSkills) 
    ? (deps.tokenizeSkills ? deps.tokenizeSkills(job.requiredSkills) : (deps.normalizeSkills ? deps.normalizeSkills(job.requiredSkills) : job.requiredSkills.map(s => s.toLowerCase()))) 
    : legacyRequired;
  const ORIGINAL_REQUIRED_TECHNOLOGIES = job && Array.isArray(job.requiredSkills) ? job.requiredSkills : legacyRequired;
  const PREFERRED_TECHNOLOGIES = job && Array.isArray(job.preferredSkills) 
    ? (deps.tokenizeSkills ? deps.tokenizeSkills(job.preferredSkills) : (deps.normalizeSkills ? deps.normalizeSkills(job.preferredSkills) : job.preferredSkills.map(s => s.toLowerCase()))) 
    : legacyPreferred;
  const ROLE_TYPES = job && job.roleTitle ? [job.roleTitle] : legacyRoles;
  const ROLES_NEEDED = job && Array.isArray(job.rolesNeeded) && job.rolesNeeded.length > 0 ? job.rolesNeeded : [];

  const {
    getEmbedding,
    getValidatedCommentary,
    getChatCompletion,
    validateCandidateSchema,
    normalizeSkills,
    tokenizeSkills,
    normalizeDomains,
    buildContextText,
    stableCandidateFingerprint,
    calibrateRoleScores,
    deepFreeze,
    deepCopy,
    cosineSimilarity,
  } = deps;

  const PROJECT_REQUIRED_SKILLS = REQUIRED_TECHNOLOGIES;
  const JOB_SKILL_WEIGHTS = [
    ...REQUIRED_TECHNOLOGIES.map((skill) => ({ skill, weight: 1 })),
    ...PREFERRED_TECHNOLOGIES.map((skill) => ({ skill, weight: 0.7 })),
  ];

  function getPriority(score) {
    if (score >= 75) return "high";
    if (score >= 40) return "medium";
    return "low";
  }

  // Fallback regex skills extraction — covers full internal role taxonomy
  function regexExtractSkills(text) {
    if (!text || typeof text !== "string") return [];
    const RULES = [
      // Frontend
      { re: /\breact(?:\.js|js)?\b/i,              out: "react" },
      { re: /\bvue(?:\.js|js)?\b/i,                out: "vue.js" },
      { re: /\bangular(?:js|\.js)?\b/i,             out: "angular" },
      { re: /\bnext(?:\.js|js)\b/i,                 out: "next.js" },
      { re: /\btailwind(?:\s*css)?\b/i,              out: "tailwind css" },
      { re: /\bjavascript\b/i,                       out: "javascript" },
      { re: /\btypescript\b/i,                       out: "typescript" },
      { re: /\bhtml[5]?\b/i,                         out: "html" },
      { re: /\bcss[3]?\b/i,                          out: "css" },
      { re: /\bsass\b/i,                             out: "sass" },
      { re: /\bwebpack\b/i,                          out: "webpack" },
      { re: /\bvite\b/i,                             out: "vite" },
      { re: /\bredux\b/i,                            out: "redux" },
      { re: /\bbootstrap\b/i,                        out: "bootstrap" },
      { re: /\bjquery\b/i,                           out: "jquery" },
      // Backend
      { re: /\bnode(?:\.js|js)?\b/i,                out: "node.js" },
      { re: /\bexpress(?:\.js|js)?\b/i,             out: "express.js" },
      { re: /\bmongodb\b|\bmongo\b/i,               out: "mongodb" },
      { re: /\bmongoose\b/i,                         out: "mongoose" },
      { re: /\brest\s*api[s]?\b|\brestful\b/i,      out: "rest apis" },
      { re: /\bgraphql\b/i,                          out: "graphql" },
      { re: /\bsocket\.io\b/i,                       out: "socket.io" },
      { re: /\bmysql\b/i,                            out: "mysql" },
      { re: /\bpostgresql\b|\bpostgres\b/i,          out: "postgresql" },
      { re: /\bpython\b/i,                           out: "python" },
      { re: /\bjava\b(?!script)/i,                   out: "java" },
      { re: /\bc#\b|\bcsharp\b/i,                   out: "c#" },
      { re: /\bgo(?:lang)?\b/i,                      out: "golang" },
      { re: /\bphp\b/i,                              out: "php" },
      { re: /\bredis\b/i,                            out: "redis" },
      { re: /\bdjango\b/i,                           out: "django" },
      { re: /\bflask\b/i,                            out: "flask" },
      { re: /\bfastapi\b|\bfast\s*api\b/i,           out: "fastapi" },
      { re: /\blaravel\b/i,                          out: "laravel" },
      { re: /\bspring\s*boot\b/i,                    out: "spring boot" },
      { re: /\bhibernate\b/i,                        out: "hibernate" },
      { re: /\bgrpc\b/i,                             out: "grpc" },
      { re: /\bmicroservices\b/i,                    out: "microservices" },
      { re: /\bjwt\b/i,                              out: "jwt" },
      { re: /\bsql\b/i,                              out: "sql" },
      { re: /\brabbitmq\b|\brabbit\s*mq\b/i,         out: "rabbitmq" },
      { re: /\bmqtt\b/i,                             out: "mqtt" },
      { re: /\bkafka\b/i,                            out: "kafka" },
      { re: /\bcelery\b/i,                           out: "celery" },
      // DevOps
      { re: /\bdocker\b/i,                           out: "docker" },
      { re: /\bkubernetes\b|\bk8s\b/i,              out: "kubernetes" },
      { re: /\bterraform\b/i,                        out: "terraform" },
      { re: /\bjenkins\b/i,                          out: "jenkins" },
      { re: /\bansible\b/i,                          out: "ansible" },
      { re: /\baws\b/i,                              out: "aws" },
      { re: /\bazure\b/i,                            out: "azure" },
      { re: /\bci\/?cd\b/i,                          out: "ci/cd" },
      { re: /\blinux\b/i,                            out: "linux" },
      { re: /\bbash\b/i,                             out: "bash" },
      { re: /\bprometheus\b/i,                       out: "prometheus" },
      { re: /\bgrafana\b/i,                          out: "grafana" },
      { re: /\bgit\b|\bgithub\b/i,                  out: "git" },
      // QA
      { re: /\bselenium\b/i,                         out: "selenium" },
      { re: /\bcypress\b/i,                          out: "cypress" },
      { re: /\bplaywright\b/i,                       out: "playwright" },
      { re: /\bjest\b/i,                             out: "jest" },
      { re: /\bmocha\b/i,                            out: "mocha" },
      { re: /\bjunit\b/i,                            out: "junit" },
      // AI/ML/Data
      { re: /\bmachine\s*learning\b/i,               out: "machine learning" },
      { re: /\btensorflow\b/i,                       out: "tensorflow" },
      { re: /\bpytorch\b/i,                          out: "pytorch" },
      { re: /\bscikit[\s-]?learn\b/i,               out: "scikit-learn" },
      { re: /\bnlp\b/i,                              out: "nlp" },
      { re: /\bpandas\b/i,                           out: "pandas" },
      { re: /\bnumpy\b/i,                            out: "numpy" },
      { re: /\btableau\b/i,                          out: "tableau" },
      { re: /\bpower\s*bi\b/i,                       out: "power bi" },
      // Agile
      { re: /\bscrum\b/i,                            out: "scrum" },
      { re: /\bagile\b/i,                            out: "agile" },
      { re: /\bkanban\b/i,                           out: "kanban" },
      { re: /\bjira\b/i,                             out: "jira" },
      // Mobile
      { re: /\breact[\s-]?native\b/i,               out: "react native" },
      { re: /\bflutter\b/i,                          out: "flutter" },
      { re: /\bfirebase\b/i,                         out: "firebase" },
      { re: /\bswift\b/i,                            out: "swift" },
      { re: /\bkotlin\b/i,                           out: "kotlin" },
      { re: /\bionic\b/i,                            out: "ionic" },
      { re: /\bexpo\b/i,                             out: "expo" },
    ];
    const found = new Set();
    for (const { re, out } of RULES) {
      if (re.test(text)) found.add(out);
    }
    return [...found];
  }

  function extractNestedName(obj) {
    if (!obj || typeof obj !== "object") return null;
    if (obj.name && typeof obj.name === "string" && obj.name.trim() !== "") {
      return obj.name.trim();
    }
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val === "object") {
        const res = extractNestedName(val);
        if (res) return res;
      }
    }
    return null;
  }

  function mergeTechnicalSkillsIntoParsed(parsed, fallbackSkills) {
    const copy = deepCopy(parsed || {});
    if (!Array.isArray(copy.technicalSkills)) {
      copy.technicalSkills = [];
    }
    const combined = [...new Set([...copy.technicalSkills, ...fallbackSkills])];
    copy.technicalSkills = combined;
    return copy;
  }

  function vectorPreview(vector) {
    return Array.isArray(vector)
      ? vector.slice(0, 5).map((value) => Number(value.toFixed(6)))
      : [];
  }

  function isValidVector(vector) {
    return (
      Array.isArray(vector) &&
      vector.length > 0 &&
      vector.every((value) => typeof value === "number" && Number.isFinite(value))
    );
  }

  function buildSemanticCandidateText(candidate) {
    return buildContextText([
      candidate.projectContext,
      candidate.experienceContext,
      candidate.technicalSkills,
      candidate.domains,
      candidate.rawText,
    ]).slice(0, 6000);
  }

  function tokenSet(text) {
    return new Set(
      (text || "")
        .toLowerCase()
        .split(/[^a-z0-9+#.]+/i)
        .filter((token) => token.length > 2)
    );
  }

  function deterministicLexicalFallback(leftText, rightText) {
    const left = tokenSet(leftText);
    const right = tokenSet(rightText);
    if (left.size === 0 || right.size === 0) return 0;
    let overlap = 0;
    for (const token of left) {
      if (right.has(token)) overlap++;
    }
    const union = new Set([...left, ...right]).size || 1;
    return overlap / union;
  }

  async function getValidatedEmbedding(text, label) {
    const meta = await getEmbedding(text);
    if (!meta || !isValidVector(meta.vector)) {
      throw new Error(`[SEMANTIC EMBEDDING INVALID] ${label}: embedding service returned malformed vector`);
    }
    debugPipeline(
      `[SEMANTIC VECTOR] ${label} | dim=${meta.vector.length} | first=${JSON.stringify(vectorPreview(meta.vector))} | cached=${meta.cached} | sourceLength=${meta.sourceLength}`
    );
    return meta;
  }

  function extractTopLevelJSON(text) {
    if (!text || typeof text !== "string") return null;
    const firstObj = text.indexOf("{");
    const firstArr = text.indexOf("[");

    let start = -1;
    let openChar = "";
    let closeChar = "";
    if (firstObj !== -1 && (firstArr === -1 || firstObj < firstArr)) {
      start = firstObj;
      openChar = "{";
      closeChar = "}";
    } else if (firstArr !== -1) {
      start = firstArr;
      openChar = "[";
      closeChar = "]";
    } else {
      return null;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === openChar) depth++;
      else if (ch === closeChar) {
        depth--;
        if (depth === 0) {
          return text.slice(start, i + 1);
        }
      }
    }
    return null;
  }

  /* -----------------------------
     STEP 1: STRUCTURED EXTRACTION
  ----------------------------- */
  const candidates = [];
  const chunkSize = 10;
  
  for (let i = 0; i < cvs.length; i += chunkSize) {
    const chunk = cvs.slice(i, i + chunkSize);
    
    const chunkPromises = chunk.map(async (cv) => {
      try {
        const regexSkills = regexExtractSkills(cv.text);
        const prompt = `
Extract structured information from the CV text below and return ONLY a valid JSON object.

CRITICAL EXTRACTION RULES — follow these exactly:
1. ONLY include skills that are EXPLICITLY written or named in the CV text. Use the exact technology name you find.
2. Do NOT infer, assume, or hallucinate skills. If the CV does not say "Python", do NOT add Python.
3. Do NOT substitute synonyms or related technologies. If the CV says "MQTT", write "MQTT" — do NOT write "RabbitMQ" or anything else.
4. Do NOT add skills that are commonly paired with the candidate's other skills unless they are explicitly written.
5. Do NOT copy skills from any other candidate. This CV belongs to one person only.

Required JSON Schema (every field must be present, use empty arrays if no data):
{
  "name": "Full Name of Candidate",
  "technicalSkills": ["skill1", "skill2"],
  "languages": ["lang1"],
  "domains": ["domain1"],
  "softSkills": ["softskill1"]
}

CV Text:
${cv.text}
        `.trim();

        const raw = await getChatCompletion({
          model: "llama-3.1-8b-instant",
          temperature: 0,
          top_p: 1,
          messages: [
            { role: "system", content: "You are a precise JSON extractor. Output ONLY valid JSON adhering exactly to the requested schema. No conversational filler, no extra keys." },
            { role: "user", content: prompt },
          ],
          cacheKeyPrompt: prompt,
        });

        let parsed = null;
        const clean = extractTopLevelJSON(raw) || raw;

        try {
          parsed = JSON.parse(clean);
          if (parsed && typeof parsed === "object") {
            if (!Array.isArray(parsed.technicalSkills)) parsed.technicalSkills = [];
            if (!Array.isArray(parsed.languages)) parsed.languages = [];
            if (!Array.isArray(parsed.domains)) parsed.domains = [];
            if (!Array.isArray(parsed.softSkills)) parsed.softSkills = [];
          }
          parsed = mergeTechnicalSkillsIntoParsed(parsed, regexSkills);
        } catch {
          parsed = null;
        }

        if (!parsed) {
          // Use regex-extracted skills as fallback so candidates are not silently zeroed
          parsed = {
            name: cv.name,
            technicalSkills: regexSkills,
            languages: [],
            domains: [],
            softSkills: [],
            isValid: regexSkills.length > 0,
            invalidReason: regexSkills.length > 0 ? undefined : "json_parse_failed_or_unextractable",
          };
        }

        const resolvedName = extractNestedName(parsed);
        if (
          parsed.fullName &&
          typeof parsed.fullName === "string" &&
          parsed.fullName.trim().length > (parsed.name || "").trim().length
        ) {
          parsed.name = parsed.fullName.trim();
        } else if (!parsed.name || parsed.name === "Unknown" || parsed.name === "unknown") {
          if (resolvedName) parsed.name = resolvedName;
        }

        if (Array.isArray(parsed.technicalSkills)) {
          parsed.technicalSkills = mergeTechnicalSkillsIntoParsed(parsed, []).technicalSkills;
        } else {
          parsed = mergeTechnicalSkillsIntoParsed(parsed, []);
        }

        parsed.id = cv.id;
        parsed.rawText = cv.text;
        const validation = validateCandidateSchema(parsed);
        if (!validation.isValid) {
          parsed.isValid = false;
          parsed.invalidReason = validation.errors.join("; ");
        } else {
          parsed.isValid = true;
        }
        return deepFreeze(deepCopy(parsed));
      } catch {
        // API unavailable — use regex skills so the candidate is not silently zeroed
        const fallbackSkills = regexExtractSkills(cv.text);
        return deepFreeze(deepCopy({
          id: cv.id,
          name: cv.name,
          technicalSkills: fallbackSkills,
          languages: [],
          domains: [],
          softSkills: [],
          isValid: fallbackSkills.length > 0,
          invalidReason: fallbackSkills.length > 0 ? undefined : "extraction_failed",
          rawText: cv.text
        }));
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    candidates.push(...chunkResults);
  }

  /* -----------------------------
     STEP 2: NORMALIZATION / FINGERPRINTING / EMBEDDINGS
  ----------------------------- */
  const projectEmbeddingText = [
    project.name,
    job ? job.normalizedDescription : project.description,
    ...REQUIRED_TECHNOLOGIES,
    ...PREFERRED_TECHNOLOGIES,
    project.sector,
  ].join(" ");

  const jobRequirementText = [
    "required technologies",
    ...REQUIRED_TECHNOLOGIES,
    "preferred technologies",
    ...PREFERRED_TECHNOLOGIES,
    "role type",
    ...ROLE_TYPES,
    project.name,
    job ? job.normalizedDescription : project.description,
  ].join(" ");

  let projectEmbeddingMeta = null;
  let requirementsEmbeddingMeta = null;
  let projectEmbedding = null;
  let requirementsEmbedding = null;
  let jobEmbeddingFailure = null;

  try {
    projectEmbeddingMeta = await getValidatedEmbedding(projectEmbeddingText, "job project");
    requirementsEmbeddingMeta = await getValidatedEmbedding(jobRequirementText, "job requirements");
    projectEmbedding = projectEmbeddingMeta.vector;
    requirementsEmbedding = requirementsEmbeddingMeta.vector;
  } catch (err) {
    jobEmbeddingFailure = err;
    warnPipeline(`[SEMANTIC FALLBACK] Job embeddings failed; using deterministic lexical fallback. ${err.message}`);
  }

  const trimmedCandidates = candidates.map((c) => {
    const hasValidName =
      c.name &&
      typeof c.name === "string" &&
      c.name.trim() !== "" &&
      c.name !== "Unknown" &&
      c.name !== "unknown";

    const technicalSkills = tokenizeSkills ? tokenizeSkills(c.technicalSkills) : normalizeSkills(c.technicalSkills);
    const domains = normalizeDomains(c.domains);
    const softSkills = normalizeSkills(c.softSkills).slice(0, 5);
    const projectContext = buildContextText([
      c.projects, c.project, c.projectExperience, c.academicProjects, c.portfolio,
    ]);
    let experienceContext = buildContextText([
      c.experience, c.workExperience, c.professionalExperience, c.employment, c.workHistory, c.positions,
    ]);
    if (!projectContext && !experienceContext) {
      experienceContext = c.rawText || "";
    }

    const existingInvalidReason =
      c.isValid === false ? c.invalidReason || "invalid_candidate" : null;

    const invalidReason =
      existingInvalidReason ||
      (!hasValidName
        ? "invalid_or_missing_name"
        : technicalSkills.length === 0
          ? "empty_skills"
          : null);

    const assignedDomain = assignDomain([
      technicalSkills.join(" "),
      domains.join(" "),
      projectContext,
      experienceContext
    ]);

    return {
      id: c.id,
      name: hasValidName ? c.name.trim() : c.name || "Unknown",
      technicalSkills,
      domains,
      assignedDomain,
      softSkills,
      projectContext,
      experienceContext,
      rawText: c.rawText || "",
      isValid: invalidReason === null,
      invalidReason: invalidReason || undefined,
    };
  });

  const fingerprints = {};
  for (const c of trimmedCandidates) {
    fingerprints[c.name] = stableCandidateFingerprint(c);
  }

  const projectSimilarities = [];
  const requirementsSimilarities = [];

  for (const c of trimmedCandidates) {
    if (!c.isValid) {
      projectSimilarities.push(0);
      requirementsSimilarities.push(0);
      warnPipeline(`[SEMANTIC SKIP] ${c.id}: invalid candidate (${c.invalidReason || "unknown"}); semantic score set to deterministic zero`);
      continue;
    }
    const candidateSemanticText = buildSemanticCandidateText(c);
    if (!candidateSemanticText) {
      warnPipeline(`[SEMANTIC FALLBACK] ${c.id}: no candidate semantic text; assigning deterministic zero similarity`);
      projectSimilarities.push(0);
      requirementsSimilarities.push(0);
      c._embeddingDebug = {
        semanticSourceLength: 0,
        projectSourceLength: 0,
        projectCached: false,
        expSourceLength: 0,
        expCached: false,
        jobReqSourceLength: requirementsEmbeddingMeta?.sourceLength || jobRequirementText.length,
        rawProjSim: 0,
        rawReqSim: 0,
        semanticFallback: "empty_candidate_text",
      };
      continue;
    }

    let candProjMeta = null;
    let candExpMeta = null;
    let projSim = 0;
    let reqSim = 0;
    let semanticFallback = null;

    try {
      if (jobEmbeddingFailure) throw jobEmbeddingFailure;
      candProjMeta = await getValidatedEmbedding(candidateSemanticText, `candidate ${c.id} semantic`);
      candExpMeta = candProjMeta;

      projSim = cosineSimilarity(candProjMeta.vector, projectEmbedding);
      reqSim = cosineSimilarity(candExpMeta.vector, requirementsEmbedding);
    } catch (err) {
      semanticFallback = err.message;
      warnPipeline(`[SEMANTIC FALLBACK] ${c.id}: embedding comparison failed; using deterministic lexical fallback. ${err.message}`);
      projSim = deterministicLexicalFallback(candidateSemanticText, projectEmbeddingText);
      reqSim = deterministicLexicalFallback(candidateSemanticText, jobRequirementText);
    }

    projectSimilarities.push(projSim);
    requirementsSimilarities.push(reqSim);
    
    // Store metadata for debugging
    c._embeddingDebug = {
      semanticSourceLength: candidateSemanticText.length,
      projectSourceLength: candProjMeta?.sourceLength || candidateSemanticText.length,
      projectVectorDim: candProjMeta?.vector?.length || 0,
      projectVectorFirst: vectorPreview(candProjMeta?.vector),
      expSourceLength: candExpMeta?.sourceLength || candidateSemanticText.length,
      expVectorDim: candExpMeta?.vector?.length || 0,
      expVectorFirst: vectorPreview(candExpMeta?.vector),
      jobReqSourceLength: requirementsEmbeddingMeta?.sourceLength || jobRequirementText.length,
      jobReqVectorDim: requirementsEmbedding?.length || 0,
      jobReqVectorFirst: vectorPreview(requirementsEmbedding),
      rawProjSim: projSim,
      rawReqSim: reqSim,
      semanticFallback
    };
  }

  function absoluteClampAndScale(values) {
    // FIXED ABSOLUTE BOUNDS (Cosine Similarity -> 0-1)
    // Avoids relative percentile distortion in mixed batches
    const MIN_SIM = semanticScoringConfig.minSimilarity;
    const MAX_SIM = semanticScoringConfig.maxSimilarity;
    
    return values.map(val => {
      if (val <= MIN_SIM) return 0;
      if (val >= MAX_SIM) return 1;
      return (val - MIN_SIM) / (MAX_SIM - MIN_SIM);
    });
  }

  const normalizedProjSims = absoluteClampAndScale(projectSimilarities);
  const normalizedReqSims = absoluteClampAndScale(requirementsSimilarities);

  const candidatesWithEmbeddings = trimmedCandidates.map((c, i) => {
    const mappedJobDomain = job && job.domain && job.domain !== "Unknown" ? job.domain : assignDomain(job ? job.roleTitle : project.sector);
    const domainMismatch = mappedJobDomain !== "OTHER" && c.assignedDomain !== "OTHER" && mappedJobDomain !== c.assignedDomain;
    const scaledProjSim = domainMismatch ? Math.min(0.05, normalizedProjSims[i]) : normalizedProjSims[i];
    const scaledReqSim = domainMismatch ? Math.min(0.05, normalizedReqSims[i]) : normalizedReqSims[i];

    return {
      ...c,
      _projectSimilarity: scaledProjSim,
      _requirementsSimilarity: scaledReqSim,
    };
  });

  const scoredCandidates = candidatesWithEmbeddings.map((candidate) => {
    const candidateSkills = candidate.technicalSkills || [];
    
    // In-core implementation of skill weights
    const contextWeightedSkills = [...new Set(candidateSkills)]
      .map((skill) => {
        const projectHits = deps.countSkillOccurrences(candidate.projectContext, skill);
        const experienceHits = deps.countSkillOccurrences(candidate.experienceContext, skill);
        const listed = candidateSkills.includes(skill);
        const projectWeight = deps.dampenFrequency(projectHits);
        const experienceWeight = deps.dampenFrequency(experienceHits) * 0.6;
        const listedWeight = listed ? 0.3 : 0;
        let weight = Math.max(projectWeight, experienceWeight, listedWeight);
        let source = "technicalSkills";

        if (projectWeight > 0) source = "project";
        else if (experienceWeight > 0) source = "experience";
        else if (listed) weight -= 0.2;

        return { skill, weight: Math.max(0, weight), source, projectHits, experienceHits };
      })
      .sort((a, b) => b.weight - a.weight || a.skill.localeCompare(b.skill));

    const weightedMatches = JOB_SKILL_WEIGHTS.map(({ skill, weight }) => {
      const matchingCandidateSkills = contextWeightedSkills.filter((item) => {
        try {
          const regex = new RegExp(`\\b${item.skill.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'i');
          return regex.test(skill);
        } catch { return false; }
      });
      if (matchingCandidateSkills.length > 0) {
        const bestMatch = matchingCandidateSkills.reduce((prev, current) => (prev.weight > current.weight) ? prev : current);
        return Math.min(1, bestMatch.weight) * weight;
      }
      return 0;
    });
    const possible = JOB_SKILL_WEIGHTS.reduce((sum, item) => sum + item.weight, 0) || 1;
    const skillScore = deps.clampScore((weightedMatches.reduce((sum, value) => sum + value, 0) / possible) * 100);

    const matchedRequired = REQUIRED_TECHNOLOGIES.filter((skill) => {
      const matchingCandidateSkills = contextWeightedSkills.filter((item) => {
        try {
          const regex = new RegExp(`\\b${item.skill.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'i');
          return regex.test(skill);
        } catch { return false; }
      });
      return matchingCandidateSkills.some(match => match.experienceHits > 0);
    });
    const experienceScore = REQUIRED_TECHNOLOGIES.length === 0
      ? 0
      : deps.clampScore((matchedRequired.length / REQUIRED_TECHNOLOGIES.length) * 100);

    let embeddingScore = candidate._projectSimilarity || 0;
    
    const softSkillScore = Math.min(100, candidate.softSkills.length * 20);

    const roleAssignment = calibrateRoleScores({
      candidateSkills,
      projectContext: candidate.projectContext,
      experienceContext: candidate.experienceContext,
      embeddingScore,
      requiredSkills: REQUIRED_TECHNOLOGIES,
      rolesNeeded: ROLES_NEEDED,
      audit: options.audit || false,
    });

    let resolvedPrimary = roleAssignment.primary;
    const roleDist = roleAssignment.roleDistribution || [];
    roleAssignment.primary = resolvedPrimary;

    // Retrieve score matching resolved winner
    const winningDist = roleDist.find(item => item.role === resolvedPrimary) || roleDist[0];
    let score = winningDist ? winningDist.score : 0;
    const roleBreakdown = roleAssignment.roleScoreBreakdown[resolvedPrimary] || {};
    let symbolicScore = roleBreakdown.symbolicScore !== undefined ? roleBreakdown.symbolicScore : score;
    let semanticScore = roleBreakdown.semanticScore !== undefined ? roleBreakdown.semanticScore : 0;
    let semanticComponent = roleBreakdown.semanticComponent !== undefined ? roleBreakdown.semanticComponent : 0;

    // DOMAIN COMPATIBILITY PENALTY
    const mappedJobDomain = job && job.domain && job.domain !== "Unknown" ? job.domain : assignDomain(job ? job.roleTitle : project.sector);
    let domainCompatibility = "Match";
    if (mappedJobDomain !== "OTHER" && candidate.assignedDomain !== "OTHER" && mappedJobDomain !== candidate.assignedDomain) {
      // Cross-domain mismatch (e.g. Nurse applying for Software Engineer)
      score = Math.min(mismatchPenaltyConfig.domainMismatchScoreCap, score * mismatchPenaltyConfig.domainMismatchScoreMultiplier);
      symbolicScore = Math.min(mismatchPenaltyConfig.domainMismatchScoreCap, symbolicScore * mismatchPenaltyConfig.domainMismatchScoreMultiplier);
      domainCompatibility = "Mismatch";
    }

    // SENIORITY-AWARE MODIFIERS
    const jobSeniority = job ? (job.seniority || "").toLowerCase() : "";
    let seniorityMatch = "N/A";
    if (jobSeniority.includes("senior") || jobSeniority.includes("lead")) {
      const isSenior = candidate.experienceContext.toLowerCase().includes("senior") || candidate.experienceContext.toLowerCase().includes("lead");
      if (!isSenior) {
        score = score * mismatchPenaltyConfig.seniorityPenaltyMultiplier;
        symbolicScore = symbolicScore * mismatchPenaltyConfig.seniorityPenaltyMultiplier;
        seniorityMatch = "Lacking Seniority";
      } else {
        seniorityMatch = "Match";
      }
    }

    // Detailed classification outputs
    const targetProfile = internalRoles.find(r => r.name === resolvedPrimary) || internalRoles[0];
    
    let matchedSkills, missingSkills;
    if (ORIGINAL_REQUIRED_TECHNOLOGIES && ORIGINAL_REQUIRED_TECHNOLOGIES.length > 0) {
      matchedSkills = ORIGINAL_REQUIRED_TECHNOLOGIES.filter(req => {
        const reqNormArr = deps.tokenizeSkills ? deps.tokenizeSkills([req]) : [req.toLowerCase()];
        return reqNormArr.some(rn => candidateSkills.includes(rn));
      });
      missingSkills = ORIGINAL_REQUIRED_TECHNOLOGIES.filter(req => {
        const reqNormArr = deps.tokenizeSkills ? deps.tokenizeSkills([req]) : [req.toLowerCase()];
        return !reqNormArr.some(rn => candidateSkills.includes(rn));
      });
    } else {
      // Fallback only if the project completely failed to provide required technologies
      matchedSkills = candidateSkills.filter(s => targetProfile.coreSkills.includes(s) || targetProfile.optionalSkills.includes(s));
      missingSkills = targetProfile.coreSkills.filter(s => !candidateSkills.includes(s));
    }
    const nearbyAlternativeRoles = roleDist
      .filter(item => item.role !== resolvedPrimary && item.score >= 35)
      .map(item => ({ role: item.role, score: item.score }));

    const normalizationChecksPassed = [
      embeddingScore, skillScore, experienceScore, score,
      ...roleAssignment.roleDistribution.map((item) => item.score),
    ].every((value) => Number.isFinite(value) && value >= 0 && value <= 100);

    const debug = {
      rawEmbeddingScore: Number(((candidate._projectSimilarity || 0) * 20).toFixed(2)),
      embeddingScore,
      embeddingScorePercent: Number(((candidate._projectSimilarity || 0) * 100).toFixed(2)),
      skillScore,
      experienceScore,
      symbolicScore: Math.max(0, Math.min(80, symbolicScore)),
      semanticScore: Math.max(0, Math.min(100, semanticScore)),
      finalScoreBreakdown: roleAssignment.roleScoreBreakdown[roleAssignment.primary] || {},
      normalizationChecksPassed,
      embeddingDiagnostics: candidate._embeddingDebug || {}
    };

    const engineStrengths = contextWeightedSkills
      .filter((item) => item.weight > 0)
      .map((item) => item.skill)
      .slice(0, 3);

    const engineWeaknesses = PROJECT_REQUIRED_SKILLS
      .filter((skill) => !candidateSkills.some((cs) => cs.includes(skill)))
      .slice(0, 2);

    const supportedStrengths = contextWeightedSkills
      .filter((item) => item.source === "project" || item.source === "experience")
      .slice(0, 3)
      .map((item) => `${item.skill} (${item.source})`);

    const engineReasons = [
      `Embedding score ${embeddingScore} from candidate project context versus job requirements`,
      experienceScore > 0
        ? `Experience context supports ${experienceScore}% of listed skills`
        : "Experience context does not support listed skills",
      supportedStrengths.length > 0
        ? `Top project/experience-supported skills: ${supportedStrengths.join(", ")}`
        : "No project or experience support found for listed skills",
    ];

    return {
      id: candidate.id,
      name: candidate.name,
      score: Math.max(0, Math.min(100, score)),
      symbolicScore: Math.max(0, Math.min(80, symbolicScore)),
      semanticScore: semanticScore,
      semanticComponent: semanticComponent,
      priority: getPriority(score),
      technicalFit: Math.round(skillScore),
      skillScore,
      experienceScore,
      softSkillScore,
      domainMatch: Number((embeddingScore * 20).toFixed(2)),
      projectMatchScore: Number((embeddingScore * 20).toFixed(2)),
      technicalSkills: candidateSkills,
      domains: candidate.domains,
      isValid: candidate.isValid,
      invalidReason: candidate.invalidReason,
      roleAssignment,
      predictedRole: resolvedPrimary,
      confidenceScore: roleAssignment.confidence,
      matchedSkills,
      missingSkills,
      nearbyAlternativeRoles,
      engineStrengths,
      engineWeaknesses,
      engineReasons,
      debug,
      contextWeightedSkills,
      assignedDomain: candidate.assignedDomain,
      mappedJobDomain,
      domainCompatibility,
      seniorityMatch
    };
  });

  // 1. Establish True Hybrid Sort with Local Anti-Vibe Rule
  const constrainedRanking = [...scoredCandidates].sort((a, b) => {
    if (b.score !== a.score) {
      // Local Anti-Vibe Rule: if candidates are adjacent (score difference < 10)
      // AND there's a massive symbolic gap (> 10), do not let semantic reorder them.
      const scoreDiff = Math.abs(b.score - a.score);
      const symbolicDiff = b.symbolicScore - a.symbolicScore;
      
      if (
        scoreDiff < adjacencyReorderConfig.maxAdjacentScoreDifference &&
        Math.abs(symbolicDiff) > adjacencyReorderConfig.minSymbolicDifference
      ) {
        return symbolicDiff;
      }
      return b.score - a.score;
    }
    
    // Tiebreakers
    if (b.symbolicScore !== a.symbolicScore) {
      return b.symbolicScore - a.symbolicScore;
    }
    const overlapA = a.matchedSkills?.length || 0;
    const overlapB = b.matchedSkills?.length || 0;
    if (overlapB !== overlapA) {
      return overlapB - overlapA;
    }
    const lenA = a.technicalSkills?.join(" ").length || 0;
    const lenB = b.technicalSkills?.join(" ").length || 0;
    if (lenA !== lenB) {
      return lenB - lenA; // descending
    }
    return a.id.localeCompare(b.id);
  });

  // Recalculate rank and percentileRank after constrained reordering
  constrainedRanking.forEach((c, index) => {
    c.rank = index + 1;
    c.percentileRank = constrainedRanking.length > 1 ? ((constrainedRanking.length - 1 - index) / (constrainedRanking.length - 1)) * 100 : 100;
  });

  // Put sorted candidates back
  scoredCandidates.length = 0;
  scoredCandidates.push(...constrainedRanking);

  const finalRanking = scoredCandidates.map((candidate, index) => ({
    id: candidate.id,
    rank: index + 1,
    name: candidate.name,
    score: candidate.score,
    percentileRank: candidate.percentileRank,
    priority: candidate.priority,
    role: candidate.roleAssignment.primary,
    secondaryRole: candidate.roleAssignment.secondary,
    confidence: candidate.roleAssignment.confidence,
    roleDistribution: candidate.roleAssignment.roleDistribution,
    predictedRole: candidate.predictedRole,
    confidenceScore: candidate.confidenceScore,
    matchedSkills: candidate.matchedSkills,
    missingSkills: candidate.missingSkills,
    nearbyAlternativeRoles: candidate.nearbyAlternativeRoles,
    projectMatchScore: candidate.projectMatchScore,
    skillScore: candidate.skillScore,
    experienceScore: candidate.experienceScore,
    softSkillScore: candidate.softSkillScore,
    symbolicScore: candidate.symbolicScore,
    semanticScore: candidate.semanticScore,
    semanticComponent: candidate.semanticComponent,
    finalScore: candidate.score,
    debug: candidate.debug,
    strengths: candidate.engineStrengths,
    weaknesses: candidate.engineWeaknesses,
    isValid: candidate.isValid,
    invalidReason: candidate.invalidReason,
    assignedDomain: candidate.assignedDomain,
    mappedJobDomain: candidate.mappedJobDomain,
    domainCompatibility: candidate.domainCompatibility,
    seniorityMatch: candidate.seniorityMatch
  }));

  // Prepare rich context for the LLM so it isn't guessing blindly
  const llmProjectContext = `
PROJECT NAME: ${project.name}
DOMAIN: ${project.sector || job?.domain || "Software Engineering"}
REQUIRED SKILLS: ${REQUIRED_TECHNOLOGIES.join(", ")}
DESCRIPTION: ${job ? job.normalizedDescription : project.description}
  `.trim();

  // Only pass the top 7 to the LLM to ensure high-quality, non-repetitive generation.
  // The rest will automatically fallback to the native engineReasons.
  const topCandidatesForLLM = scoredCandidates.slice(0, 7).map(c => ({
    name: c.name,
    roleMatch: c.roleAssignment.primary,
    score: c.score,
    topSkills: c.technicalSkills.slice(0, 10).join(", "),
    missingRequiredSkills: c.missingSkills.slice(0, 5).join(", "),
    experienceSummary: (c.experienceContext + " " + c.projectContext).substring(0, 400).trim() + "..."
  }));

  const commentaryPrompt = `
You are a senior technical recruiter writing a structured evaluation for a hiring manager.
Your job is to explain each candidate's fit for the specific project in clear, direct, human language.

${llmProjectContext}

PERSONA & TONE RULES (follow strictly):
- Write as a confident senior recruiter who has read every CV and knows what the project actually needs.
- Be direct and specific. Avoid filler phrases like "the profile shows", "based on the CV", "this candidate demonstrates".
- Use active voice. Lead with the insight.
- Never repeat a candidate's name more than once per reasoning block.
- Keep it concise: recommendation = 1 punchy sentence, each reason = 1 sentence max.
- Maximum 3 reasons per candidate.

REASON QUALITY RULES:
- Use the candidate's actual "experienceSummary" to write personalized reasons.
- Explain WHY a skill or trait matters for this specific project — not just list it.
  BAD: "Has experience with docker and aws."
  GOOD: "Hands-on Docker and AWS experience maps directly to the project's infrastructure automation needs."
- UNIQUE RISKS: You MUST NOT copy-paste the same risk across candidates. Tailor the weakness to the specific candidate's profile.
- If there is a gap in missingRequiredSkills, describe the actual impact or risk in the context of what they DO know.
  BAD: "CV does not confirm kubernetes."
  GOOD: "While strong in Node.js, they will likely need ramp-up time on Kubernetes before owning cloud orchestration independently."

RECOMMENDATION RULES:
- The recommendation field should be one punchy sentence that gives a verdict.
  GOOD: "Solid DevOps fit — ready to contribute from day one on CI/CD and cloud infrastructure."
  GOOD: "Consider with validation — strong backend skills but will need support on orchestration."

OUTPUT FORMAT (strict JSON, no extra keys):
{
  "summaryText": "2-3 sentences assessing overall team readiness for this specific project.",
  "ranking": [
    {
      "name": "Candidate Full Name",
      "recommendation": "One punchy verdict sentence",
      "reasons": ["reason 1", "reason 2", "reason 3"]
    }
  ]
}

TOP CANDIDATES DATA:
${JSON.stringify(topCandidatesForLLM, null, 2)}
`;


  let commentary;
  let commentaryMap = {};
  let summaryText = "";

  try {
    commentary = await getValidatedCommentary(commentaryPrompt);
    const parsed = JSON.parse(commentary);
    if (parsed.summaryText) {
      summaryText = parsed.summaryText;
    }
    if (Array.isArray(parsed.ranking)) {
      for (const item of parsed.ranking) {
        if (item.name) {
          commentaryMap[item.name.trim().toLowerCase()] = {
            recommendation: item.recommendation || null,
            reasons: Array.isArray(item.reasons) ? item.reasons : [],
          };
        }
      }
    }
  } catch (err) {
    warnPipeline(`[COMMENTARY FALLBACK] Commentary generation failed; using deterministic empty commentary. ${err.message}`);
  }

  return {
    ranking: scoredCandidates.map((candidate, index) => {
      const item = {
        id: candidate.id,
        rank: index + 1,
        name: candidate.name,
        score: candidate.score,
        priority: candidate.priority,
        role: candidate.roleAssignment.primary,
        secondaryRole: candidate.roleAssignment.secondary,
        confidence: candidate.roleAssignment.confidence,
        roleDistribution: candidate.roleAssignment.roleDistribution,
        predictedRole: candidate.predictedRole,
        confidenceScore: candidate.confidenceScore,
        matchedSkills: candidate.matchedSkills,
        missingSkills: candidate.missingSkills,
        nearbyAlternativeRoles: candidate.nearbyAlternativeRoles,
        projectMatchScore: candidate.projectMatchScore,
        skillScore: candidate.skillScore,
        experienceScore: candidate.experienceScore,
        softSkillScore: candidate.softSkillScore,
        symbolicScore: candidate.symbolicScore,
        semanticScore: candidate.semanticScore,
        semanticComponent: candidate.semanticComponent,
        debug: candidate.debug,
        isValid: candidate.isValid,
        invalidReason: candidate.invalidReason,
      };

      const llm = commentaryMap[candidate.name?.trim().toLowerCase()] || {};
      item.recommendation = llm.recommendation || candidate.roleAssignment.primary;
      item.reasons = llm.reasons?.length > 0 ? llm.reasons : candidate.engineReasons;
      item.strengths = candidate.engineStrengths;
      item.weaknesses = candidate.engineWeaknesses;
      item.technicalSkills = candidate.technicalSkills;
      item.assignedDomain = candidate.assignedDomain;
      item.mappedJobDomain = candidate.mappedJobDomain;
      item.domainCompatibility = candidate.domainCompatibility;
      item.seniorityMatch = candidate.seniorityMatch;
      
      if (options.audit && candidate.roleAssignment.audit) {
        item.audit = candidate.roleAssignment.audit;
      }
      return item;
    }),
    summary: {
      totalCandidates: scoredCandidates.length,
      averageScore:
        scoredCandidates.length === 0
          ? 0
          : Math.round(scoredCandidates.reduce((sum, c) => sum + c.score, 0) / scoredCandidates.length),
      topRole: scoredCandidates[0]?.roleAssignment.primary || "Unknown",
      summaryText: summaryText || "",
    },
    fingerprints,
  };
}
