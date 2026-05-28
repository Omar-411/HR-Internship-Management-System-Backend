// ─── DOMAIN TAXONOMY ─────────────────────────────────────────────────────────
// Each keyword entry: { kw: string, weight: number }
// Higher weight = stronger signal for that domain.
// NOTE: Only list skills/terms that are DISTINCTIVE to a domain.
// Avoid listing general programming languages here unless they are exclusively
// associated with that domain (e.g. do NOT put 'python' in SOFTWARE_ENGINEERING
// because it also belongs to DATA_ENGINEERING and AI_ML).
export const DOMAIN_TAXONOMY = {
  SOFTWARE_ENGINEERING: [
    { kw: 'react',              weight: 3 },
    { kw: 'node.js',            weight: 3 },
    { kw: 'nodejs',             weight: 3 },
    { kw: 'express.js',         weight: 3 },
    { kw: 'expressjs',          weight: 3 },
    { kw: 'mongodb',            weight: 3 },
    { kw: 'frontend',           weight: 2 },
    { kw: 'backend',            weight: 2 },
    { kw: 'fullstack',          weight: 2 },
    { kw: 'full-stack',         weight: 2 },
    { kw: 'full stack',         weight: 2 },
    { kw: 'web developer',      weight: 2 },
    { kw: 'web application',    weight: 2 },
    { kw: 'mern stack',         weight: 4 },
    { kw: 'mern',               weight: 4 },
    { kw: 'java',               weight: 1 },
    { kw: 'typescript',         weight: 1 },
    { kw: 'javascript',         weight: 2 },
    { kw: 'golang',             weight: 2 },
    { kw: 'software engineer',  weight: 2 },
    { kw: 'software developer', weight: 2 },
    { kw: 'software',           weight: 2 },
    { kw: 'technology',         weight: 2 },
    { kw: 'tech',               weight: 1 },
  ],
  AI_ML: [
    { kw: 'machine learning',  weight: 4 },
    { kw: 'deep learning',     weight: 4 },
    { kw: 'tensorflow',        weight: 4 },
    { kw: 'pytorch',           weight: 4 },
    { kw: 'scikit-learn',      weight: 3 },
    { kw: 'nlp',               weight: 3 },
    { kw: 'data scientist',    weight: 4 },
    { kw: 'ai engineer',       weight: 4 },
    { kw: 'llm',               weight: 3 },
    { kw: 'neural network',    weight: 3 },
  ],
  HEALTHCARE: [
    { kw: 'nurse',             weight: 5 },
    { kw: 'nursing',           weight: 5 },
    { kw: 'patient care',      weight: 5 },
    { kw: 'clinical',          weight: 3 },
    { kw: 'medical',           weight: 3 },
    { kw: 'hospital',          weight: 3 },
    { kw: 'physician',         weight: 5 },
    { kw: 'doctor',            weight: 5 },
    { kw: 'icu',               weight: 5 },
    { kw: 'ehr',               weight: 4 },
    { kw: 'epic',              weight: 3 },
    { kw: 'cerner',            weight: 4 },
    { kw: 'hl7',               weight: 4 },
    { kw: 'fhir',              weight: 4 },
    { kw: 'hipaa',             weight: 3 },
    { kw: 'healthcare it',     weight: 5 },
    { kw: 'clinical data',     weight: 4 },
    { kw: 'biomarker',         weight: 4 },
    { kw: 'clinical trial',    weight: 5 },
    { kw: 'phase iii',         weight: 5 },
    { kw: 'regulatory submission', weight: 5 },
    { kw: 'fda',               weight: 4 },
    { kw: 'sas',               weight: 2 },
  ],
  HR: [
    { kw: 'human resources',   weight: 5 },
    { kw: 'recruitment',       weight: 5 },
    { kw: 'talent acquisition',weight: 5 },
    { kw: 'onboarding',        weight: 4 },
    { kw: 'hris',              weight: 5 },
    { kw: 'workday',           weight: 4 },
    { kw: 'sap successfactors',weight: 5 },
    { kw: 'hr manager',        weight: 5 },
    { kw: 'hr technology',     weight: 5 },
    { kw: 'performance management', weight: 4 },
    { kw: 'compensation',      weight: 3 },
    { kw: 'labor law',         weight: 4 },
    { kw: 'payroll',           weight: 3 },
  ],
  LEGAL: [
    { kw: 'legal',             weight: 3 },
    { kw: 'lawyer',            weight: 5 },
    { kw: 'attorney',          weight: 5 },
    { kw: 'law',               weight: 3 },
    { kw: 'compliance',        weight: 2 },
    { kw: 'contract',          weight: 2 },
  ],
  FINANCE: [
    { kw: 'accountant',        weight: 5 },
    { kw: 'finance',           weight: 3 },
    { kw: 'tax preparation',   weight: 5 },
    { kw: 'audit',             weight: 3 },
    { kw: 'cpa',               weight: 5 },
    { kw: 'gaap',              weight: 5 },
    { kw: 'financial reporting', weight: 4 },
    { kw: 'accounts payable',  weight: 4 },
    { kw: 'balance sheet',     weight: 4 },
  ],
  DATA_ENGINEERING: [
    { kw: 'data analyst',      weight: 5 },
    { kw: 'data analysis',     weight: 4 },
    { kw: 'data engineer',     weight: 5 },
    { kw: 'etl',               weight: 4 },
    { kw: 'data warehouse',    weight: 4 },
    { kw: 'tableau',           weight: 3 },
    { kw: 'power bi',          weight: 3 },
    { kw: 'pandas',            weight: 3 },
    { kw: 'numpy',             weight: 3 },
    { kw: 'statistical analysis', weight: 4 },
    { kw: 'statistical modeling', weight: 4 },
    { kw: 'spss',              weight: 4 },
    { kw: 'r programming',     weight: 4 },
    { kw: 'biostatistics',     weight: 4 },
    { kw: 'clinical kpi',      weight: 5 },
  ],
  DESIGN: [
    { kw: 'graphic designer',  weight: 5 },
    { kw: 'graphic design',    weight: 5 },
    { kw: 'brand design',      weight: 5 },
    { kw: 'visual identity',   weight: 5 },
    { kw: 'figma',             weight: 3 },
    { kw: 'photoshop',         weight: 3 },
    { kw: 'illustrator',       weight: 3 },
    { kw: 'after effects',     weight: 3 },
    { kw: 'typography',        weight: 4 },
    { kw: 'color theory',      weight: 4 },
    { kw: 'print design',      weight: 5 },
    { kw: 'motion graphics',   weight: 4 },
    { kw: 'canva',             weight: 3 },
    { kw: 'adobe creative suite', weight: 5 },
    { kw: 'brand identity',    weight: 5 },
  ],
  EDUCATION: [
    { kw: 'teacher',           weight: 5 },
    { kw: 'curriculum',        weight: 5 },
    { kw: 'lesson plan',       weight: 5 },
    { kw: 'classroom',         weight: 5 },
    { kw: 'student assessment',weight: 5 },
    { kw: 'tutoring',          weight: 4 },
    { kw: 'mathematics teacher', weight: 5 },
    { kw: 'calculus',          weight: 2 },
    { kw: 'khan academy',      weight: 4 },
    { kw: 'google classroom',  weight: 4 },
  ],
  MECHANICAL_ENGINEERING: [
    { kw: 'mechanical engineer',  weight: 5 },
    { kw: 'cad',                  weight: 3 },
    { kw: 'solidworks',           weight: 5 },
    { kw: 'autocad',              weight: 5 },
    { kw: 'finite element analysis', weight: 5 },
    { kw: 'fea',                  weight: 4 },
    { kw: 'thermodynamics',       weight: 5 },
    { kw: 'manufacturing',        weight: 3 },
    { kw: 'lean manufacturing',   weight: 5 },
    { kw: 'cnc machining',        weight: 5 },
    { kw: '3d printing',          weight: 3 },
    { kw: 'iso standards',        weight: 3 },
    { kw: 'pump',                 weight: 2 },
    { kw: 'industrial machinery', weight: 5 },
  ],
  ADMINISTRATION: [
    { kw: 'administrative assistant', weight: 5 },
    { kw: 'calendar management',  weight: 5 },
    { kw: 'scheduling',           weight: 3 },
    { kw: 'data entry',           weight: 3 },
    { kw: 'filing',               weight: 3 },
    { kw: 'reception',            weight: 4 },
    { kw: 'executive support',    weight: 5 },
    { kw: 'document preparation', weight: 4 },
    { kw: 'meeting coordination', weight: 4 },
  ],
  MARKETING: [
    { kw: 'digital marketing',    weight: 5 },
    { kw: 'seo',                  weight: 4 },
    { kw: 'sem',                  weight: 4 },
    { kw: 'google analytics',     weight: 4 },
    { kw: 'social media marketing', weight: 5 },
    { kw: 'facebook ads',         weight: 5 },
    { kw: 'copywriting',          weight: 4 },
    { kw: 'email campaign',       weight: 4 },
    { kw: 'content creation',     weight: 3 },
    { kw: 'hubspot',              weight: 4 },
    { kw: 'roas',                 weight: 5 },
    { kw: 'ad budget',            weight: 4 },
  ],
};

export function assignDomain(textArrayOrString) {
  if (!textArrayOrString) return 'OTHER';

  const textToSearch = Array.isArray(textArrayOrString)
    ? textArrayOrString.join(' ').toLowerCase()
    : String(textArrayOrString).toLowerCase();

  const domainScores = {};

  for (const [domain, entries] of Object.entries(DOMAIN_TAXONOMY)) {
    let score = 0;
    for (const entry of entries) {
      const kw = entry.kw;
      const weight = entry.weight || 1;
      const escapedKw = kw.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedKw}\\b`, 'g');
      const hits = textToSearch.match(regex);
      if (hits) {
        score += hits.length * weight;
      }
    }
    if (score > 0) {
      domainScores[domain] = score;
    }
  }

  // Find highest scoring domain
  let bestDomain = 'OTHER';
  let maxScore = 0;
  for (const [domain, score] of Object.entries(domainScores)) {
    if (score > maxScore) {
      maxScore = score;
      bestDomain = domain;
    }
  }

  return bestDomain;
}
