import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { parseCsvFile } from "../core/parser.js";
import { buildIntelligenceLayer } from "../core/builder.js";
import { getSkillOrOccupationEmbedding } from "../core/embeddingService.js";
import { isTechOccupation } from "../core/techFilters.js";

dotenv.config();

// Make sure the target directory exists
const DATA_DIR = "./data";
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function run() {
  console.log("Starting ESCO Semantic intelligence layer import pipeline...");
  const startTime = Date.now();

  try {
    const skillsPath = "./data/esco/skills_en.csv";
    const occupationsPath = "./data/esco/occupations_en.csv";
    const digitalSkillsPath = "./data/esco/digitalSkillsCollection_en.csv";

    console.log("Parsing CSVs...");
    let rawSkills = await parseCsvFile(skillsPath);
    let rawOccupations = await parseCsvFile(occupationsPath);
    let digitalSkills = await parseCsvFile(digitalSkillsPath);

    console.log(`Filtering non-tech occupations. Initial: ${rawOccupations.length}`);
    rawOccupations = rawOccupations.filter(o => isTechOccupation(o.preferredLabel || ""));
    console.log(`Tech-only filtered: ${rawOccupations.length}`);

    // If LIMIT env is set, we slice the inputs to keep execution times fast under development/test
    const limitEnabled = process.env.LIMIT_RECORDS === "true" || !process.env.FULL_RUN;
    if (limitEnabled) {
      console.log("LIMIT_RECORDS enabled. Selective tech-boosting enabled for testing.");
      
      const techKeywords = ["react", "node", "express", "mongodb", "javascript", "rest api", "api", "html", "css", "software", "development"];
      const techSkills = rawSkills.filter(s => {
        const label = (s.preferredLabel || "").toLowerCase();
        return techKeywords.some(kw => label.includes(kw));
      });

      const techOccs = rawOccupations.filter(o => {
        const title = (o.preferredLabel || "").toLowerCase();
        return title.includes("developer") || title.includes("software") || title.includes("programmer");
      });

      rawSkills = [...rawSkills.slice(0, 300), ...techSkills].slice(0, 600);
      rawOccupations = [...rawOccupations.slice(0, 50), ...techOccs].slice(0, 110);
      digitalSkills = digitalSkills.slice(0, 50);
    }

    // Prepare injected dependencies
    const deps = {
      getEmbedding: getSkillOrOccupationEmbedding
    };

    console.log("Building Intelligence Layer...");
    const { skills, occupations, skillGraph } = await buildIntelligenceLayer(
      rawSkills,
      rawOccupations,
      digitalSkills,
      deps
    );

    console.log("Writing JSON files to data/...");
    fs.writeFileSync(path.join(DATA_DIR, "skills.json"), JSON.stringify(skills, null, 2), "utf8");
    fs.writeFileSync(path.join(DATA_DIR, "occupations.json"), JSON.stringify(occupations, null, 2), "utf8");
    fs.writeFileSync(path.join(DATA_DIR, "skillGraph.json"), JSON.stringify(skillGraph, null, 2), "utf8");

    // Metrics calculation
    const numSkills = skills.length;
    const numOccupations = occupations.length;
    
    let numRelations = 0;
    for (const occ of occupations) {
      numRelations += (occ.relatedSkills || []).length;
    }
    for (const skillId of Object.keys(skillGraph)) {
      numRelations += skillGraph[skillId].length;
    }

    const weakMappings = occupations.filter(occ => occ.weakMapping).map(occ => occ.title);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log("\n==========================================");
    console.log("🎉 ESCO IMPORT PIPELINE COMPLETED SUCCESSFULLY!");
    console.log(`⏱️ Duration: ${duration}s`);
    console.log(`📚 Skills Loaded: ${numSkills}`);
    console.log(`💼 Occupations Loaded: ${numOccupations}`);
    console.log(`🔗 Total Relationships Built: ${numRelations}`);
    console.log(`⚠️ Weak Mappings Flagged: ${weakMappings.length}`);
    if (weakMappings.length > 0) {
      console.log("Weakly Mapped Occupations:");
      console.log(weakMappings.slice(0, 10).map(title => ` - ${title}`).join("\n"));
      if (weakMappings.length > 10) {
        console.log(` ... and ${weakMappings.length - 10} more`);
      }
    }
    console.log("==========================================\n");

  } catch (error) {
    console.error("❌ Pipeline failed with error:", error);
    process.exitCode = 1;
  }
}

run();