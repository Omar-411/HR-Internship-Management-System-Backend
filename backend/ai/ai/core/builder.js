import { extractIdFromUri, parseAltLabels, normalizeText } from "./normalizer.js";
import { getSkillOrOccupationEmbedding, cosineSimilarity } from "./embeddingService.js";

const debugPipeline = (...args) => {
  if (process.env.DEBUG_PIPELINE === "true") console.log(...args);
};

/**
 * Builds standard, queryable JSON models from parsed ESCO entities.
 */

/**
 * Maps skills to occupations and constructs the priority-based skill graph.
 * 
 * @param {Array<object>} rawSkills - Parsed rows from skills CSV.
 * @param {Array<object>} rawOccupations - Parsed rows from occupations CSV.
 * @param {Array<object>} digitalSkills - Parsed rows from digital skills CSV.
 * @param {object} deps - Injected embedding and utility dependencies.
 * @returns {Promise<object>} { skills, occupations, skillGraph }
 */
export async function buildIntelligenceLayer(rawSkills, rawOccupations, digitalSkills, deps) {
  const { getEmbedding } = deps;

  debugPipeline("Normalizing skills and occupations...");
  
  // 1. Clean and normalize all skills
  const skillsMap = new Map();

  // Inject modern tech skills so they exist canonically in the database
  const modernTechSkills = [
    { skillId: "reactjs", label: "React", altLabels: ["ReactJS", "React.js", "react"], description: "Web front-end library.", relatedSkills: [], skillType: "knowledge", inScheme: "digital" },
    { skillId: "nodejs", label: "Node.js", altLabels: ["NodeJS", "nodejs", "node"], description: "Server-side JavaScript environment.", relatedSkills: [], skillType: "knowledge", inScheme: "digital" },
    { skillId: "expressjs", label: "Express", altLabels: ["ExpressJS", "expressjs", "express"], description: "Web framework for Node.js.", relatedSkills: [], skillType: "knowledge", inScheme: "digital" },
    { skillId: "mongodb", label: "MongoDB", altLabels: ["Mongo", "mongodb", "mongo db"], description: "NoSQL document database.", relatedSkills: [], skillType: "knowledge", inScheme: "digital" },
    { skillId: "restapi", label: "REST APIs", altLabels: ["REST API", "restapi", "restful api", "api"], description: "Representational State Transfer web services.", relatedSkills: [], skillType: "knowledge", inScheme: "digital" },
    { skillId: "javascript", label: "JavaScript", altLabels: ["JS", "javascript", "javascript programming"], description: "Dynamic scripting programming language.", relatedSkills: [], skillType: "knowledge", inScheme: "digital" },
    { skillId: "html", label: "HTML5", altLabels: ["HTML", "html5", "css/html"], description: "HyperText Markup Language standard.", relatedSkills: [], skillType: "knowledge", inScheme: "digital" },
    { skillId: "css", label: "CSS3", altLabels: ["CSS", "css3", "tailwind css"], description: "Cascading Style Sheets styling standard.", relatedSkills: [], skillType: "knowledge", inScheme: "digital" }
  ];
  for (const skill of modernTechSkills) {
    skillsMap.set(skill.skillId, skill);
  }

  for (const row of rawSkills) {
    const id = extractIdFromUri(row.conceptUri);
    if (!id) continue;

    const altLabels = parseAltLabels(row.altLabels);
    const skill = {
      skillId: id,
      label: row.preferredLabel || "",
      altLabels,
      description: row.description || "",
      relatedSkills: [], // Will populate from graph
      skillType: row.skillType || "",
      inScheme: row.inScheme || ""
    };
    skillsMap.set(id, skill);
  }

  // Inject digital skills additional properties or taxonomy
  const digitalSkillsMap = new Map();
  for (const row of digitalSkills) {
    const id = extractIdFromUri(row.conceptUri);
    if (!id) continue;
    digitalSkillsMap.set(id, row);
  }

  // 2. Clean and normalize all occupations
  const occupations = [];
  for (const row of rawOccupations) {
    const id = extractIdFromUri(row.conceptUri);
    if (!id) continue;

    occupations.push({
      occupationId: id,
      title: row.preferredLabel || "",
      description: row.description || "",
      relatedSkills: []
    });
  }

  debugPipeline(`Loaded ${skillsMap.size} skills and ${occupations.length} occupations.`);

  debugPipeline("Generating embeddings & matching skills to occupations semantically...");

  const skillList = Array.from(skillsMap.values());
  
  // Process each occupation
  for (const occ of occupations) {
    const occText = `${occ.title}: ${occ.description}`;
    let occEmbedding;
    try {
      occEmbedding = await getEmbedding(occText);
    } catch {
      continue;
    }

    const matchedSkills = [];
    const occTokens = new Set(normalizeText(occText).split(" "));
    
    // Fast keyword pre-filter to narrow down skills
    let candidateSkills = skillList.filter(skill => {
      const skillTokens = normalizeText(skill.label).split(" ");
      return skillTokens.some(token => token.length > 3 && occTokens.has(token));
    });

    const isTechOcc = 
      occ.title.toLowerCase().includes("developer") || 
      occ.title.toLowerCase().includes("software") || 
      occ.title.toLowerCase().includes("programmer") ||
      occ.title.toLowerCase().includes("web");
      
    if (isTechOcc) {
      const techKeywords = ["react", "node", "express", "mongodb", "javascript", "api", "html", "css", "software", "development"];
      const techSkills = skillList.filter(skill => {
        const lbl = skill.label.toLowerCase();
        return techKeywords.some(kw => lbl.includes(kw));
      });
      candidateSkills = [...new Set([...candidateSkills, ...techSkills])];
    }

    const finalCandidates = candidateSkills.length > 0 ? candidateSkills : skillList.slice(0, 50);

    for (const skill of finalCandidates) {
      let skillEmbedding;
      try {
        skillEmbedding = await getEmbedding(`${skill.label}: ${skill.description}`);
      } catch {
        continue;
      }

      const similarity = cosineSimilarity(occEmbedding, skillEmbedding);
      if (similarity >= 0.35) {
        // Augment with ESCO features: increase weight if label exists in occupation text
        let weight = similarity;
        const normalizedLabel = normalizeText(skill.label);
        const normalizedOccText = normalizeText(occText);

        if (normalizedOccText.includes(normalizedLabel)) {
          weight += 0.1;
        }

        // Check altLabels
        for (const alt of skill.altLabels) {
          if (normalizedOccText.includes(normalizeText(alt))) {
            weight += 0.05;
            break;
          }
        }

        weight = Math.min(1.0, weight);

        matchedSkills.push({
          skillId: skill.skillId,
          label: skill.label,
          importanceWeight: parseFloat(weight.toFixed(3))
        });
      }
    }

    // Sort by importance weight descending
    matchedSkills.sort((a, b) => b.importanceWeight - a.importanceWeight);
    
    occ.relatedSkills = matchedSkills.slice(0, 15); // Keep top 15

    if (isTechOcc) {
      const techSkillIds = ["reactjs", "nodejs", "expressjs", "mongodb", "restapi", "javascript", "html", "css"];
      const injectedSkills = techSkillIds.map(sid => {
        const sk = skillsMap.get(sid);
        return {
          skillId: sid,
          label: sk ? sk.label : sid,
          importanceWeight: 0.95
        };
      });
      // Prepend injected skills and deduplicate by skillId
      const combined = [...injectedSkills, ...occ.relatedSkills];
      const seen = new Set();
      const unique = [];
      for (const item of combined) {
        if (!seen.has(item.skillId)) {
          seen.add(item.skillId);
          unique.push(item);
        }
      }
      occ.relatedSkills = unique.slice(0, 15);
    }

    // Check for weak mapping
    if (occ.relatedSkills.length === 0) {
      occ.weakMapping = true;
      const fallbackSkills = finalCandidates
        .map(skill => {
          const overlap = normalizeText(skill.description)
            .split(" ")
            .filter(w => w.length > 4 && occTokens.has(w)).length;
          return { skill, overlap };
        })
        .sort((a, b) => b.overlap - a.overlap)
        .slice(0, 3)
        .filter(item => item.overlap > 0)
        .map(item => ({
          skillId: item.skill.skillId,
          label: item.skill.label,
          importanceWeight: 0.2
        }));
      
      occ.relatedSkills = fallbackSkills;
    }
  }

  // 4. Construct the priority-based skill graph
  debugPipeline("Constructing priority-based skill graph (Co-occurrence > Embedding Similarity > Taxonomy)...");
  
  const skillGraph = {};
  const skillIds = Array.from(skillsMap.keys());
  
  for (const id of skillIds) {
    skillGraph[id] = [];
  }

  // PRIORITY 1: Co-occurrence across occupations
  const skillOccupationsMap = new Map();
  for (const occ of occupations) {
    for (const skillRef of occ.relatedSkills) {
      if (!skillOccupationsMap.has(skillRef.skillId)) {
        skillOccupationsMap.set(skillRef.skillId, new Set());
      }
      skillOccupationsMap.get(skillRef.skillId).add(occ.occupationId);
    }
  }

  const coOccurrences = [];
  const activeSkillIds = Array.from(skillOccupationsMap.keys());
  for (let i = 0; i < activeSkillIds.length; i++) {
    const skillA = activeSkillIds[i];
    const occsA = skillOccupationsMap.get(skillA);

    for (let j = i + 1; j < activeSkillIds.length; j++) {
      const skillB = activeSkillIds[j];
      const occsB = skillOccupationsMap.get(skillB);

      const intersection = new Set([...occsA].filter(x => occsB.has(x)));
      if (intersection.size > 0) {
        const union = new Set([...occsA, ...occsB]);
        const jaccard = intersection.size / union.size;
        coOccurrences.push({ skillA, skillB, weight: jaccard });
      }
    }
  }

  for (const co of coOccurrences) {
    if (co.weight >= 0.1) {
      skillGraph[co.skillA].push({ skillId: co.skillB, weight: parseFloat((co.weight * 1.0).toFixed(3)), source: "co-occurrence" });
      skillGraph[co.skillB].push({ skillId: co.skillA, weight: parseFloat((co.weight * 1.0).toFixed(3)), source: "co-occurrence" });
    }
  }

  // PRIORITY 2: Embedding similarity between skills
  debugPipeline("Adding embedding similarity connections to skill graph...");
  const activeSkillsSample = skillList.slice(0, 100); 
  for (let i = 0; i < activeSkillsSample.length; i++) {
    const skillA = activeSkillsSample[i];
    let embedA;
    try {
      embedA = await getEmbedding(`${skillA.label}: ${skillA.description}`);
    } catch {
      continue;
    }

    for (let j = i + 1; j < activeSkillsSample.length; j++) {
      const skillB = activeSkillsSample[j];
      let embedB;
      try {
        embedB = await getEmbedding(`${skillB.label}: ${skillB.description}`);
      } catch {
        continue;
      }

      const sim = cosineSimilarity(embedA, embedB);
      if (sim >= 0.5) {
        const existingA = skillGraph[skillA.skillId].find(x => x.skillId === skillB.skillId);
        if (!existingA) {
          skillGraph[skillA.skillId].push({ skillId: skillB.skillId, weight: parseFloat((sim * 0.7).toFixed(3)), source: "similarity" });
          skillGraph[skillB.skillId].push({ skillId: skillA.skillId, weight: parseFloat((sim * 0.7).toFixed(3)), source: "similarity" });
        }
      }
    }
  }

  // PRIORITY 3: ESCO taxonomy links
  debugPipeline("Adding taxonomy links to skill graph...");
  for (const [id, dRow] of digitalSkillsMap) {
    const skillA = skillsMap.get(id);
    if (!skillA) continue;

    const broaderUris = (dRow.broaderConceptUri || "").split("|").map(u => extractIdFromUri(u.trim())).filter(Boolean);
    for (const bId of broaderUris) {
      const skillB = skillsMap.get(bId);
      if (skillB) {
        const existingA = skillGraph[id].find(x => x.skillId === bId);
        if (!existingA) {
          skillGraph[id].push({ skillId: bId, weight: 0.3, source: "taxonomy" });
          skillGraph[bId].push({ skillId: id, weight: 0.3, source: "taxonomy" });
        }
      }
    }
  }

  // Clean and map relatedSkills inside skills.json
  for (const skill of skillList) {
    const edges = skillGraph[skill.skillId] || [];
    edges.sort((a, b) => b.weight - a.weight);
    
    const uniqueEdges = [];
    const seen = new Set();
    for (const edge of edges) {
      if (!seen.has(edge.skillId)) {
        seen.add(edge.skillId);
        uniqueEdges.push(edge);
      }
    }
    skillGraph[skill.skillId] = uniqueEdges.slice(0, 10);
    skill.relatedSkills = uniqueEdges.slice(0, 5).map(e => e.skillId);
  }

  return {
    skills: skillList,
    occupations,
    skillGraph
  };
}
