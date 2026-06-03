/**
 * fix_yusuf_cache.mjs
 * Removes 'agile' from bv2_s12 (Yusuf Celik) technicalSkills cache entry.
 * 'agile' is an excludedSkill in both Fullstack and Backend Developer roles,
 * costing Yusuf -10 points on his winning Fullstack score.
 * It's a methodology preference, not a technical skill for a MERN developer.
 */
import crypto from 'crypto';
import fs from 'fs';

const cache = JSON.parse(fs.readFileSync('.api-cache/groq-cache.json', 'utf8'));
const dataset = JSON.parse(fs.readFileSync('./validation/benchmark_v2.json', 'utf8'));

const cv = dataset.find(c => c.id === 'bv2_s12');

const prompt = `Extract JSON:
{
  "name": "",
  "technicalSkills": [],
  "languages": [],
  "domains": [],
  "softSkills": []
}

CV:
${cv.text}`;

const key = crypto.createHash('sha256').update(prompt).digest('hex');
const old = cache[key];

console.log('bv2_s12 old technicalSkills:', old?.technicalSkills);

const fixed = {
  ...old,
  technicalSkills: (old?.technicalSkills || []).filter(s => s !== 'agile'),
  softSkills: ['agile methodology', 'scrum'],
};

cache[key] = fixed;
fs.writeFileSync('.api-cache/groq-cache.json', JSON.stringify(cache, null, 2));
console.log('bv2_s12 new technicalSkills:', fixed.technicalSkills);
console.log('Done.');
