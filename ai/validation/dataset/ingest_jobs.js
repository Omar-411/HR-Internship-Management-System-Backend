import fs from 'fs';
import path from 'path';
import csvParser from 'csv-parser';

const CSV_PATH = path.resolve(process.cwd(), 'validation/dataset/job_descriptions.csv');
const OUTPUT_PATH = path.resolve(process.cwd(), 'validation/dataset/jobs_index.json');
const TARGET_JOBS_COUNT = 50;

// Desired job titles/roles to cover our CVs (fullstack, healthcare) AND irrelevant roles (hr, legal, accounting) for negative discrimination
const TARGET_KEYWORDS = ['software', 'developer', 'engineer', 'frontend', 'backend', 'fullstack', 'nurse', 'health', 'medical', 'data', 'hr', 'human resources', 'legal', 'lawyer', 'accountant', 'finance', 'designer', 'artist'];

// Domain Taxonomy Mappings
const DOMAIN_TAXONOMY = {
  SOFTWARE_ENGINEERING: ['software', 'developer', 'engineer', 'frontend', 'backend', 'fullstack'],
  HEALTHCARE: ['nurse', 'health', 'medical', 'doctor', 'clinical'],
  HR: ['hr', 'human resources', 'recruiter'],
  LEGAL: ['legal', 'lawyer', 'attorney'],
  FINANCE: ['accountant', 'finance', 'tax', 'audit'],
  DATA_ENGINEERING: ['data'],
  DESIGN: ['designer', 'artist', 'ux', 'ui']
};

function assignDomain(title) {
  const lower = title.toLowerCase();
  for (const [domain, keywords] of Object.entries(DOMAIN_TAXONOMY)) {
    if (keywords.some(k => lower.includes(k))) {
      return domain;
    }
  }
  return 'OTHER';
}

async function ingestJobs() {
  console.log(`[INGEST] Starting job dataset ingestion...`);
  
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`[FATAL] CSV dataset missing at ${CSV_PATH}`);
    process.exit(1);
  }

  const jobs = [];
  let rowCount = 0;

  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(CSV_PATH)
      .pipe(csvParser())
      .on('data', (row) => {
        rowCount++;
        
        // Fail-fast if rows malformed
        if (!row['Job Id']) {
          console.error(`[FATAL] Malformed row detected at line ${rowCount}. Missing Job Id.`);
          process.exit(1);
        }

        const roleTitle = row['Job Title'] || row['Role'];
        
        // Fail-fast if roleTitle undefined
        if (!roleTitle) {
          console.error(`[FATAL] Malformed row detected at line ${rowCount}. Missing roleTitle.`);
          process.exit(1);
        }

        // Check if job matches our target keywords
        const isRelevant = TARGET_KEYWORDS.some(kw => 
          roleTitle.toLowerCase().includes(kw) || 
          (row['Job Description'] && row['Job Description'].toLowerCase().includes(kw))
        );

        if (isRelevant && jobs.length < TARGET_JOBS_COUNT) {
          // Extract domain based on Taxonomy
          let domain = assignDomain(roleTitle) || 'Unknown';
          
          if (domain === 'Unknown' || domain === 'OTHER') {
            try {
              if (row['Company Profile']) {
                const cleanProfile = row['Company Profile'].replace(/'/g, '"');
                const profile = JSON.parse(cleanProfile);
                domain = assignDomain(profile.Sector) !== 'OTHER' ? assignDomain(profile.Sector) : (profile.Sector || profile.Industry || 'Unknown');
              }
            } catch (e) {
              domain = assignDomain(row['Company']) !== 'OTHER' ? assignDomain(row['Company']) : (row['Company'] || 'Unknown');
            }
          }

          // Extract skills
          const rawSkills = row['skills'] ? row['skills'] : '';
          const skillsList = rawSkills.split(',').map(s => s.trim()).filter(Boolean);

          const jobNode = {
            id: row['Job Id'],
            roleTitle: roleTitle,
            seniority: row['Experience'] || 'Not specified',
            requiredSkills: skillsList,
            preferredSkills: [], // Could be derived if we had explicit data
            domain: domain,
            rawDescription: row['Job Description'] || '',
            normalizedDescription: (row['Job Description'] || '').toLowerCase().replace(/[^a-z0-9\s]/g, ''),
            extractedKeywords: skillsList.map(s => s.toLowerCase())
          };

          jobs.push(jobNode);
        }

        if (jobs.length >= TARGET_JOBS_COUNT) {
          // We have enough data
          stream.destroy(); // Stop reading the 1.7GB file
        }
      })
      .on('close', () => {
        finish(jobs);
        resolve();
      })
      .on('end', () => {
        finish(jobs);
        resolve();
      })
      .on('error', (err) => {
        console.error(`[FATAL] Error parsing CSV:`, err);
        reject(err);
      });
  });
}

function finish(jobs) {
  if (jobs.length === 0) {
    console.error(`[FATAL] No jobs found matching target criteria.`);
    process.exit(1);
  }

  console.log(`[INGEST] Successfully extracted ${jobs.length} jobs.`);
  
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(jobs, null, 2), 'utf-8');
  console.log(`[INGEST] Saved structured dataset to ${OUTPUT_PATH}`);
}

ingestJobs().catch(console.error);
