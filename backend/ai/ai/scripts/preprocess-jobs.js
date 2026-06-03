import fs from "fs";
import csv from "csv-parser";
import dotenv from "dotenv";

dotenv.config();

const jobs = [];
const limitEnabled = process.env.LIMIT_RECORDS === "true" || !process.env.FULL_RUN;
const maxRows = limitEnabled ? 100 : Infinity;

console.log(`Starting job preprocessing...`);
if (limitEnabled) {
  console.log(`LIMIT_RECORDS enabled. Preprocessing a representative sample of ${maxRows} jobs.`);
} else {
  console.log(`FULL_RUN enabled. Preprocessing all jobs (Warning: Large dataset, may take some time).`);
}

function cleanSkill(skill) {
  return skill
    .toLowerCase()
    .replace(/[^\w\s+#.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSkills(skillText = "") {
  return skillText
    .split(/[,•]/)
    .map(cleanSkill)
    .filter(Boolean);
}

const fileStream = fs.createReadStream("./data/raw/dataset.csv");
const csvStream = fileStream.pipe(csv());

let count = 0;
let streamsDestroyed = false;

function finishProcessing() {
  if (streamsDestroyed) return;
  streamsDestroyed = true;

  try {
    fileStream.destroy();
    csvStream.destroy();
  } catch (err) {
    // Suppress cleanup errors
  }

  fs.writeFileSync(
    "./data/processed-jobs.json",
    JSON.stringify(jobs, null, 2)
  );

  console.log(`✅ Processed ${jobs.length} jobs`);
  console.log("📦 Saved to data/processed-jobs.json");
  process.exit(0);
}

csvStream
  .on("data", (row) => {
    if (streamsDestroyed) return;

    const skills = extractSkills(row.skills);

    const cleanedJob = {
      id: row["Job Id"],
      title: row["Job Title"] || "",
      role: row["Role"] || "",
      company: row["Company"] || "",
      experience: row["Experience"] || "",
      qualifications: row["Qualifications"] || "",
      description: row["Job Description"] || "",
      responsibilities: row["Responsibilities"] || "",
      skills,
      embeddingText: `
        ${row["Job Title"] || ""}
        ${row["Role"] || ""}
        ${row["Job Description"] || ""}
        ${row["Responsibilities"] || ""}
        ${skills.join(" ")}
      `
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim(),
    };

    jobs.push(cleanedJob);
    count++;

    if (count >= maxRows) {
      console.log(`Reached representative limit of ${maxRows} rows.`);
      finishProcessing();
    }
  })
  .on("end", () => {
    finishProcessing();
  })
  .on("error", (err) => {
    if (err.code !== "ERR_STREAM_PREMATURE_CLOSE") {
      console.error("Stream error:", err);
      process.exit(1);
    }
  });