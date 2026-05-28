/**
 * Canonical Skill Dictionary for early normalization of technical skills.
 * Maps variations of skills (e.g. "React.js", "node", "mongo db", "rest api") to clean canonical keys.
 */

export const SKILL_DICTIONARY = {
  // Frontend
  "react": "reactjs",
  "react.js": "reactjs",
  "reactjs": "reactjs",
  "next.js": "nextjs",
  "nextjs": "nextjs",
  "tailwind": "tailwindcss",
  "tailwind css": "tailwindcss",
  "tailwindcss": "tailwindcss",
  "vue": "vuejs",
  "vue.js": "vuejs",
  "vuejs": "vuejs",
  "angular": "angular",
  "angularjs": "angular",
  "angular.js": "angular",
  "javascript": "javascript",
  "js": "javascript",
  "typescript": "typescript",
  "ts": "typescript",
  "html": "html",
  "html5": "html",
  "css": "css",
  "css3": "css",
  "sass": "sass",
  "webpack": "webpack",
  "vite": "vite",
  "redux": "redux",
  "bootstrap": "bootstrap",

  // Backend
  "node": "nodejs",
  "node.js": "nodejs",
  "nodejs": "nodejs",
  "express": "expressjs",
  "expressjs": "expressjs",
  "express.js": "expressjs",
  "mongodb": "mongodb",
  "mongo db": "mongodb",
  "mongo": "mongodb",
  "rest api": "restapi",
  "rest apis": "restapi",
  "restapi": "restapi",
  "restful api": "restapi",
  "restful apis": "restapi",
  "api": "restapi",
  "apis": "restapi",
  "mysql": "mysql",
  "postgresql": "postgresql",
  "postgres": "postgresql",
  "c#": "csharp",
  "csharp": "csharp",
  "python": "python",
  "java": "java",
  "golang": "golang",
  "go": "golang",
  "redis": "redis",
  "graphql": "graphql",
  "microservices": "microservices",
  "django": "django",
  "flask": "flask",
  "fastapi": "fastapi",
  "fast api": "fastapi",
  "spring boot": "springboot",
  "springboot": "springboot",
  "prisma": "prisma",
  "rabbitmq": "rabbitmq",
  "rabbit mq": "rabbitmq",
  "mqtt": "mqtt",
  "kafka": "kafka",
  "apache kafka": "kafka",
  "celery": "celery",

  // DevOps / Infrastructure
  "docker": "docker",
  "kubernetes": "kubernetes",
  "k8s": "kubernetes",
  "terraform": "terraform",
  "jenkins": "jenkins",
  "ansible": "ansible",
  "aws": "aws",
  "amazon web services": "aws",
  "azure": "azure",
  "microsoft azure": "azure",
  "ci/cd": "cicd",
  "cicd": "cicd",
  "continuous integration": "cicd",
  "continuous deployment": "cicd",
  "linux": "linux",
  "bash": "bash",
  "shell": "bash",
  "prometheus": "prometheus",
  "grafana": "grafana",
  "git": "git",
  "github": "git",
  "gitlab": "git",
  "nginx": "nginx",

  // QA / Testing
  "selenium": "selenium",
  "cypress": "cypress",
  "playwright": "playwright",
  "jest": "jest",
  "mocha": "mocha",
  "junit": "junit",
  "postman": "postman",
  "manual testing": "manualtesting",
  "manualtesting": "manualtesting",
  "automation testing": "automationtesting",
  "test automation": "automationtesting",
  "automationtesting": "automationtesting",
  "jmeter": "jmeter",
  "performance testing": "performancetesting",
  "performancetesting": "performancetesting",

  // UI/UX Design
  "figma": "figma",
  "sketch": "sketch",
  "adobe xd": "adobexd",
  "adobexd": "adobexd",
  "photoshop": "photoshop",
  "adobe photoshop": "photoshop",
  "illustrator": "illustrator",
  "adobe illustrator": "illustrator",
  "wireframing": "wireframing",
  "prototyping": "prototyping",
  "user research": "userresearch",
  "userresearch": "userresearch",
  "ui design": "uidesign",
  "uidesign": "uidesign",
  "ux design": "uxdesign",
  "uxdesign": "uxdesign",
  "design systems": "designsystems",
  "designsystems": "designsystems",
  "web design": "webdesign",

  // Agile / Scrum
  "scrum": "scrum",
  "agile": "agile",
  "agile methodology": "agile",
  "kanban": "kanban",
  "facilitation": "facilitation",
  "jira": "jira",
  "confluence": "confluence",
  "sprint planning": "sprintplanning",
  "sprintplanning": "sprintplanning",
  "sprint review": "sprintreview",
  "sprintreview": "sprintreview",
  "daily scrum": "dailyscrum",
  "dailyscrum": "dailyscrum",
  "retrospective": "retrospective",
  "sprint retrospective": "retrospective",
  "project management": "projectmanagement",
  "projectmanagement": "projectmanagement",
  "product ownership": "productownership",
  "productownership": "productownership",
  "coaching": "coaching",
  "mentoring": "mentoring",
  "trello": "trello",

  // Mobile
  "react native": "reactnative",
  "reactnative": "reactnative",
  "react-native": "reactnative",
  "flutter": "flutter",
  "swift": "swift",
  "kotlin": "kotlin",
  "ionic": "ionic",
  "expo": "expo",
  "firebase": "firebase",

  // AI / ML / Data Science
  "machine learning": "machinelearning",
  "machinelearning": "machinelearning",
  "tensorflow": "tensorflow",
  "pytorch": "pytorch",
  "scikit-learn": "scikitlearn",
  "scikit learn": "scikitlearn",
  "scikitlearn": "scikitlearn",
  "deep learning": "deeplearning",
  "deeplearning": "deeplearning",
  "nlp": "nlp",
  "natural language processing": "nlp",
  "computer vision": "computervision",
  "computervision": "computervision",
  "llms": "llms",
  "llm": "llms",
  "pandas": "pandas",
  "numpy": "numpy",
  "r": "r",

  // BI / Analytics
  "tableau": "tableau",
  "power bi": "powerbi",
  "powerbi": "powerbi",
  "data warehousing": "datawarehousing",
  "datawarehousing": "datawarehousing",
  "etl": "etl",
  "data modeling": "datamodeling",
  "datamodeling": "datamodeling",
  "dashboard design": "dashboarddesign",
  "dashboarddesign": "dashboarddesign",
  "reporting": "reporting",
  "snowflake": "snowflake",
  "excel": "excel"
};

/**
 * Normalizes a raw skill name into its canonical dictionary representation.
 * If not found in the dictionary, returns a cleaned concatenated string.
 * @param {string} skillName - Raw skill string.
 * @returns {string} The canonical skill string.
 */
export function getCanonicalSkill(skillName) {
  if (!skillName) return "";
  
  // Trim and convert to lowercase
  const lower = skillName.toLowerCase().trim();

  // Check direct match
  if (SKILL_DICTIONARY[lower]) {
    return SKILL_DICTIONARY[lower];
  }

  // Remove dots, hyphens, underscores and extra spaces
  const cleaned = lower
    .replace(/[.\-_]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (SKILL_DICTIONARY[cleaned]) {
    return SKILL_DICTIONARY[cleaned];
  }

  // Remove all spaces
  const fullyCleaned = cleaned.replace(/\s+/g, "");
  if (SKILL_DICTIONARY[fullyCleaned]) {
    return SKILL_DICTIONARY[fullyCleaned];
  }

  // Fallback to lowercased original
  return lower;
}

/**
 * Normalizes an array of skills and removes duplicates.
 * @param {Array<string>} skills - Array of raw skill strings.
 * @returns {Array<string>} Deduped array of canonical skill strings.
 */
export function normalizeSkillsArray(skills) {
  if (!Array.isArray(skills)) return [];
  const normalized = skills
    .map(s => getCanonicalSkill(s))
    .filter(Boolean);
  return [...new Set(normalized)].sort();
}
