import fs from 'fs';
import path from 'path';

// Deterministic Random Number Generator
function createLcg(seed) {
  let state = seed;
  return function() {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  }
}

// Fixed seed for benchmark reproducibility
const rng = createLcg(42);

// Synonym mapping strictly for soft skills/verbs (Core technical skills must be untouched)
const SYNONYMS = {
  "Problem solver": "Troubleshooter",
  "Communication": "Interpersonal communication",
  "Adaptability": "Flexibility",
  "Creativity": "Innovative thinking",
  "Self-motivated": "Proactive",
  "Independent": "Self-reliant",
  "cooperative": "collaborative",
  "Calm under pressure": "Resilient under stress",
  "Developed": "Engineered",
  "Built": "Constructed",
  "Designed": "Architected",
  "Implemented": "Integrated",
  "Managed": "Directed"
};

const FLUFF_SENTENCES = [
  "I am highly motivated and driven to succeed in a fast-paced environment.",
  "Passionate about leveraging multidisciplinary skills to deliver impactful results.",
  "Eager to synergize with cross-functional teams and drive paradigm shifts.",
  "Proven track record of thinking outside the box to maximize synergistic ROI.",
  "Demonstrated ability to pivot strategies in dynamic, evolving organizational ecosystems.",
  "Committed to lifelong learning and pushing the boundaries of technological innovation."
];

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function applyLevelA(text) {
  let mutated = text;
  // Paraphrasing only soft skills/verbs
  for (const [key, val] of Object.entries(SYNONYMS)) {
    if (rng() > 0.5) {
      mutated = mutated.replace(new RegExp(`\\b${key}\\b`, 'gi'), val);
    }
  }
  // Add some whitespace formatting changes
  mutated = mutated.replace(/\n\n/g, rng() > 0.5 ? "\n\n\n" : "\n");
  return mutated;
}

function applyLevelB(text) {
  let mutated = applyLevelA(text);
  // Reorder paragraphs
  const paragraphs = mutated.split(/\n{2,}/).filter(p => p.trim() !== "");
  
  // Don't shuffle everything to avoid complete chaos. Just swap two random paragraphs.
  if (paragraphs.length >= 3) {
    const idx1 = Math.floor(rng() * paragraphs.length);
    const idx2 = Math.floor(rng() * paragraphs.length);
    [paragraphs[idx1], paragraphs[idx2]] = [paragraphs[idx2], paragraphs[idx1]];
  }
  
  return paragraphs.join("\n\n");
}

function applyLevelC(text) {
  let mutated = applyLevelB(text);
  // Inject irrelevant but realistic fluff
  const paragraphs = mutated.split(/\n{2,}/).filter(p => p.trim() !== "");
  
  const fluffCount = Math.floor(rng() * 3) + 1; // 1 to 3 fluff sentences
  let fluffBlock = "";
  for(let i=0; i<fluffCount; i++) {
    fluffBlock += FLUFF_SENTENCES[Math.floor(rng() * FLUFF_SENTENCES.length)] + " ";
  }
  
  // Insert fluff at a random paragraph position
  const injectIdx = Math.floor(rng() * (paragraphs.length + 1));
  paragraphs.splice(injectIdx, 0, fluffBlock.trim());
  
  return paragraphs.join("\n\n");
}

function generateDataset(baseCvs, size) {
  const copiesPerBase = size / baseCvs.length; // e.g., 50 / 5 = 10
  const result = [];
  
  // Level distribution: 60% A, 30% B, 10% C
  const numA = Math.round(copiesPerBase * 0.6);
  const numB = Math.round(copiesPerBase * 0.3);
  const numC = copiesPerBase - numA - numB;

  let globalIdCounter = 1;

  for (const base of baseCvs) {
    // 1 original/base copy, the rest are mutated
    for (let i = 0; i < copiesPerBase; i++) {
      let level = 'A';
      let text = base.text;
      
      if (i < numA) {
        level = 'A';
        if (i !== 0) text = applyLevelA(text); // Keep first one untouched purely
      } else if (i < numA + numB) {
        level = 'B';
        text = applyLevelB(text);
      } else {
        level = 'C';
        text = applyLevelC(text);
      }
      
      result.push({
        id: `scale_${size}_${globalIdCounter}`,
        originalId: base.id, // Traceback to original
        name: `${base.name}_v${i+1}_lvl${level}`,
        text: `Name: ${base.name}_v${i+1}_lvl${level}\n${text}` // Inject name for LLM reliability
      });
      globalIdCounter++;
    }
  }
  
  // Shuffle the entire dataset so it's not grouped by candidate
  return shuffle(result);
}

function run() {
  const baselinePath = path.join(process.cwd(), "validation", "baseline", "cvs.json");
  if (!fs.existsSync(baselinePath)) {
    console.error("Baseline cvs.json not found! Run baseline test first.");
    process.exit(1);
  }

  const baseCvs = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  if (baseCvs.length !== 5) {
    console.warn(`Warning: Expected 5 baseline CVs, found ${baseCvs.length}`);
  }

  const mediumScale = generateDataset(baseCvs, 50);
  const largeScale = generateDataset(baseCvs, 100);

  const outDir = path.join(process.cwd(), "validation", "dataset");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(path.join(outDir, "medium_scale.json"), JSON.stringify(mediumScale, null, 2));
  console.log(`Generated medium_scale.json (${mediumScale.length} candidates)`);

  fs.writeFileSync(path.join(outDir, "large_scale.json"), JSON.stringify(largeScale, null, 2));
  console.log(`Generated large_scale.json (${largeScale.length} candidates)`);
}

run();
