import fs from "fs";
import path from "path";
import { createRequire } from "module";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

// Import pure pipeline and service dependencies
import { runRankingPipeline } from "../../core/pipeline.js";
import { getEmbedding, cosineSimilarity } from "../../core/services/embedding.service.js";
import { getValidatedCommentary, getChatCompletion } from "../../core/services/llm.service.js";
import { validateCandidateSchema } from "../../validation/schema.js";
import { normalizeSkills, normalizeDomains, buildContextText, tokenizeSkills } from "../../normalization/skills.js";
import { deepCopy, deepFreeze, stableCandidateFingerprint } from "../../normalization/fingerprint.js";
import { calibrateRoleScores, countSkillOccurrences, dampenFrequency, clampScore } from "../../core/services/scoring.service.js";
import { assignDomain } from "../../core/domainTaxonomy.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

process.env.ENABLE_GROQ_CACHE = "true";
process.env.ENABLE_EMBEDDING_CACHE = "true";

const nodeRequire = createRequire(import.meta.url);
const pdfModule = nodeRequire("pdf-parse");
const pdf = pdfModule.default || pdfModule;

async function resilientGetChatCompletion(params, retries = 5, backoffMs = 2000) {
  try {
    return await getChatCompletion(params);
  } catch (err) {
    if (retries > 0 && err.status === 429) {
      console.warn(`Rate limited by Groq. Retrying in ${backoffMs}ms...`);
      await new Promise(res => setTimeout(res, backoffMs));
      return resilientGetChatCompletion(params, retries - 1, backoffMs * 2);
    }
    throw err;
  }
}

async function runJobConditionedEvaluation() {
  console.log("=== STARTING REAL JOB-CONDITIONED MATRIX EVALUATION ===\n");

  const jobsPath = path.resolve(process.cwd(), "validation/dataset/jobs_index.json");
  const cvsPath = path.resolve(process.cwd(), "validation/dataset/cv_index.json");
  const groundTruthPath = path.resolve(process.cwd(), "validation/dataset/job_expectations.json");

  if (!fs.existsSync(jobsPath)) throw new Error("Jobs dataset missing.");
  if (!fs.existsSync(cvsPath)) throw new Error("CV dataset missing.");
  if (!fs.existsSync(groundTruthPath)) throw new Error("Job Expectations dataset missing.");

  const jobs = JSON.parse(fs.readFileSync(jobsPath, "utf8"));
  const dataset = JSON.parse(fs.readFileSync(cvsPath, "utf8"));
  const groundTruth = JSON.parse(fs.readFileSync(groundTruthPath, "utf8"));

  const pdfFiles = dataset.map(item => ({
    absolutePath: path.resolve(process.cwd(), item.file),
    filename: path.basename(item.file),
    roleLabel: item.role
  }));

  console.log(`Loaded ${jobs.length} jobs, ${pdfFiles.length} CVs, and ${groundTruth.length} ground-truth expectations.`);

  console.log("Parsing PDF resumes...");
  const cvs = await Promise.all(
    pdfFiles.map(async (fileObj, index) => {
      const buffer = fs.readFileSync(fileObj.absolutePath);
      const parsedPdf = await pdf(buffer);
      const text = parsedPdf.text || "";
      return {
        id: fileObj.filename.replace(".pdf", ""),
        name: fileObj.filename.replace(".pdf", ""),
        text: text,
      };
    })
  );

  const pipelineDeps = {
    getEmbedding,
    getValidatedCommentary: async () => JSON.stringify({ ranking: [] }),
    getChatCompletion: resilientGetChatCompletion,
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
    countSkillOccurrences,
    dampenFrequency,
    clampScore,
  };

  // Matrix Evaluation Tracking
  let totalComparisons = 0;
  let falsePositives = 0;
  let truePositives = 0;
  
  // Confusion Matrix: [Actual Domain][Predicted Mapped Job Domain] -> count of CVs that ranked high (>50)
  const confusionMatrix = {};
  
  // Select jobs that have a corresponding ground truth mapping
  const testJobs = jobs.filter(j => 
    groundTruth.some(gt => j.roleTitle.toLowerCase().includes(gt.jobRoleKeyword))
  ).slice(0, 15); // limit to 15 to not overwhelm console, but covers all domains

  if (testJobs.length === 0) {
    console.error("No jobs matched ground truth keywords. Evaluating first 5 jobs.");
    testJobs.push(...jobs.slice(0, 5));
  }

  for (const job of testJobs) {
    console.log(`\n======================================================`);
    console.log(`Evaluating Job: ${job.roleTitle} (Domain: ${job.domain})`);
    
    const input = {
      cvs,
      job,
      options: { audit: false }
    };

    const tStart = Date.now();
    const res = await runRankingPipeline(input, pipelineDeps);
    const duration = Date.now() - tStart;

    console.log(`Execution Time: ${duration}ms`);
    console.log(`Top 3 Candidates:`);
    res.ranking.slice(0, 3).forEach((candidate, idx) => {
      console.log(`${idx + 1}. ${candidate.name} (Score: ${candidate.score.toFixed(1)}, Mapped Domain: ${candidate.assignedDomain})`);
      console.log(`   Domain Comp: ${candidate.domainCompatibility}, Semantic Score: ${candidate.projectMatchScore.toFixed(1)}, Skill Score: ${candidate.skillScore.toFixed(1)}`);
      
      const overlapCount = candidate.matchedSkills ? candidate.matchedSkills.length : 0;
      const missingCount = candidate.missingSkills ? candidate.missingSkills.length : 0;
      const diag = candidate.debug?.embeddingDiagnostics || {};
      const rawCos = diag.rawProjSim !== undefined ? diag.rawProjSim.toFixed(4) : 'N/A';
      console.log(`   [DEBUG] Overlap Count: ${overlapCount}, Missing Count: ${missingCount}, Raw Cosine: ${rawCos}`);
      console.log(`   [DEBUG] Embeddings => CV Len: ${diag.projectSourceLength || 0}, Job Len: ${diag.jobReqSourceLength || 0}, Cache (CV/Job): ${diag.projectCached}/${diag.expCached}`);
    });

    const gt = groundTruth.find(g => job.roleTitle.toLowerCase().includes(g.jobRoleKeyword));
    if (gt) {
      // Evaluate expectations
      res.ranking.forEach(candidate => {
        totalComparisons++;
        const isExpectedTop = gt.expectedTopCandidates.some(n => candidate.id.toLowerCase().includes(n.toLowerCase()));
        const isExpectedLow = gt.expectedLowCandidates.some(n => candidate.id.toLowerCase().includes(n.toLowerCase()));

        if (isExpectedLow && candidate.score > 50) {
          console.warn(`[LEAKAGE DETECTED] ${candidate.name} (${candidate.id}) scored ${candidate.score.toFixed(1)} on ${job.roleTitle}`);
          falsePositives++;
        } else if (isExpectedLow && candidate.score <= 50) {
          truePositives++; // Successfully discriminated
        } else if (isExpectedTop && candidate.score > 50) {
          truePositives++;
        } else if (isExpectedTop && candidate.score <= 50) {
          falsePositives++; // Failed to rank a good candidate
        }

        // Populate Confusion Matrix
        const actualDomain = candidate.assignedDomain || 'Unknown';
        const predictedDomain = job.domain;
        
        if (!confusionMatrix[actualDomain]) confusionMatrix[actualDomain] = {};
        if (!confusionMatrix[actualDomain][predictedDomain]) confusionMatrix[actualDomain][predictedDomain] = 0;
        
        // We track "assignments" by looking at where the candidate scored highly (>60)
        if (candidate.score > 60) {
          confusionMatrix[actualDomain][predictedDomain]++;
        }
      });
    }
  }

  console.log("\n======================================================");
  console.log("=== DOMAIN CONFUSION MATRIX (High Ranking > 60) ===");
  console.log("Actual Domain \\ Predicted Job Domain");
  
  const allActualDomains = Object.keys(confusionMatrix);
  const allPredictedDomains = new Set();
  allActualDomains.forEach(ad => Object.keys(confusionMatrix[ad]).forEach(pd => allPredictedDomains.add(pd)));
  const predDomainsArray = Array.from(allPredictedDomains);

  console.log("".padEnd(25) + "| " + predDomainsArray.map(pd => pd.padEnd(20)).join(" | "));
  allActualDomains.forEach(ad => {
    const row = predDomainsArray.map(pd => (confusionMatrix[ad][pd] || 0).toString().padEnd(20));
    console.log(ad.padEnd(25) + "| " + row.join(" | "));
  });

  const accuracy = (truePositives / totalComparisons) * 100;
  console.log("\n=== DOMAIN DISCRIMINATION ACCURACY ===");
  console.log(`Total Comparisons Evaluated: ${totalComparisons}`);
  console.log(`Correct Discriminations: ${truePositives}`);
  console.log(`Leakage / False Positives: ${falsePositives}`);
  console.log(`Overall Accuracy: ${accuracy.toFixed(1)}%`);

  if (accuracy < 80) {
    console.error("\n[FAILED] Domain discrimination accuracy is below 80%. System is leaking domains.");
    process.exit(1);
  }

  console.log("\n[SUCCESS] Matrix Job-Conditioned Evaluation completed successfully!");
  process.exit(0);
}

runJobConditionedEvaluation().catch(err => {
  console.error(err);
  process.exit(1);
});
