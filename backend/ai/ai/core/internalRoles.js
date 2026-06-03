/**
 * Canonical Internal Tech Roles definition.
 * Strictly closed-world targeting exactly 10 internal roles.
 */

export const internalRoles = [
  {
    name: "Scrum Master",
    aliases: ["scrum master", "agile coach", "scrummaster", "agile practitioner", "iteration manager"],
    coreSkills: ["scrum", "agile", "kanban", "facilitation", "jira", "confluence", "sprintplanning", "sprintreview", "dailyscrum", "retrospective"],
    optionalSkills: ["projectmanagement", "productownership", "coaching", "mentoring", "trello"],
    excludedSkills: ["reactjs", "nodejs", "expressjs", "mongodb", "postgresql", "python", "java", "csharp", "golang", "devops", "kubernetes", "docker", "selenium", "cypress", "playwright", "figma"],
    description: "Facilitate agile practices, coach teams, guide scrum ceremonies, remove blockers, and manage project delivery using Scrum and Kanban methodologies."
  },
  {
    name: "Frontend Developer",
    aliases: ["frontend developer", "frontend web developer", "react developer", "ui developer", "web developer", "front end developer", "front-end developer"],
    coreSkills: ["reactjs", "javascript", "typescript", "html", "css", "nextjs", "tailwindcss", "vuejs", "angular"],
    optionalSkills: ["sass", "webpack", "vite", "redux", "graphql", "bootstrap", "figma", "restapi"],
    excludedSkills: ["kubernetes", "docker", "terraform", "jenkins", "ansible", "tableau", "powerbi", "machinelearning", "pytorch", "tensorflow"],
    description: "Build interactive user interfaces, web applications, responsive designs, and client-side applications using HTML, CSS, JavaScript, React, and modern frontend frameworks."
  },
  {
    name: "Backend Developer",
    aliases: ["backend developer", "software engineer", "api developer", "nodejs developer", "back end developer", "back-end developer", "backend engineer"],
    coreSkills: ["nodejs", "expressjs", "restapi", "mongodb", "mysql", "postgresql", "python", "java", "csharp", "golang"],
    optionalSkills: ["aws", "docker", "redis", "graphql", "microservices", "django", "flask", "springboot", "prisma"],
    excludedSkills: ["figma", "sketch", "photoshop", "css", "html", "tableau", "powerbi", "selenium", "cypress", "playwright"],
    description: "Develop server-side applications, REST APIs, databases, microservices, and backend logic using Node.js, Express, databases like MongoDB, PostgreSQL, and server technologies."
  },
  {
    name: "Fullstack Developer",
    aliases: ["fullstack developer", "full stack developer", "full-stack developer", "fullstack engineer", "full stack engineer"],
    coreSkills: ["reactjs", "nodejs", "javascript", "typescript", "expressjs", "mongodb", "postgresql", "html", "css"],
    optionalSkills: ["nextjs", "tailwindcss", "restapi", "aws", "docker", "graphql", "redis", "vuejs", "angular", "mysql"],
    excludedSkills: ["figma", "sketch", "photoshop", "tableau", "powerbi", "machinelearning", "pytorch", "tensorflow"],
    description: "Build complete end-to-end web applications, handling both frontend UI layouts with React and backend server systems, APIs, and databases with Node.js."
  },
  {
    name: "QA Engineer",
    aliases: ["qa engineer", "quality assurance engineer", "software tester", "automation tester", "qa analyst", "test engineer"],
    coreSkills: ["selenium", "cypress", "playwright", "jest", "mocha", "junit", "postman", "manualtesting", "automationtesting"],
    optionalSkills: ["cicd", "git", "javascript", "python", "java", "restapi", "jmeter", "performancetesting"],
    excludedSkills: ["figma", "sketch", "photoshop", "tableau", "powerbi", "machinelearning", "pytorch", "tensorflow", "kubernetes", "terraform", "ansible"],
    description: "Ensure software quality through manual and automated testing, writing test cases, building test automation suites using Selenium, Cypress, Playwright, Jest, and tracking defects."
  },
  {
    name: "UI/UX Designer",
    aliases: ["ui/ux designer", "ui ux designer", "product designer", "user interface designer", "user experience designer", "interaction designer", "visual designer"],
    coreSkills: ["figma", "sketch", "adobexd", "photoshop", "illustrator", "wireframing", "prototyping", "userresearch", "uidesign", "uxdesign"],
    optionalSkills: ["html", "css", "javascript", "designsystems", "webdesign"],
    excludedSkills: ["nodejs", "docker", "kubernetes", "java", "csharp", "restapi", "postgresql", "mongodb", "selenium", "cypress", "playwright", "terraform", "jenkins", "ansible"],
    description: "Design user-centered interfaces, user experiences, wireframes, prototypes, and user flows. Conduct user research and create visually appealing visual designs in Figma."
  },
  {
    name: "DevOps Engineer",
    aliases: ["devops engineer", "site reliability engineer", "sre", "cloud engineer", "infrastructure engineer", "systems administrator"],
    coreSkills: ["docker", "kubernetes", "terraform", "jenkins", "ansible", "aws", "azure", "cicd", "linux", "bash"],
    optionalSkills: ["python", "golang", "prometheus", "grafana", "git", "nginx"],
    excludedSkills: ["reactjs", "figma", "userresearch", "tableau", "powerbi", "selenium", "cypress", "playwright", "css", "html"],
    description: "Build and maintain continuous integration and deployment pipelines, manage cloud infrastructure, containerize applications, and orchestrate systems using Docker, Kubernetes, Terraform, and AWS."
  },
  {
    name: "Mobile Developer",
    aliases: ["mobile developer", "mobile engineer", "ios developer", "android developer", "flutter developer", "react native developer"],
    coreSkills: ["swift", "kotlin", "java", "flutter", "reactnative", "dart"],
    optionalSkills: ["typescript", "javascript", "restapi", "firebase"],
    excludedSkills: ["docker", "kubernetes", "terraform", "tableau", "powerbi", "machinelearning", "pytorch", "tensorflow"],
    description: "Develop native and cross-platform mobile applications for iOS and Android platforms using Swift, Kotlin, Flutter, React Native, and mobile SDKs."
  },
  {
    name: "AI Engineer",
    aliases: ["ai engineer", "ml engineer", "machine learning engineer", "ai/ml engineer", "data scientist", "deep learning engineer"],
    coreSkills: ["python", "machinelearning", "tensorflow", "pytorch", "scikitlearn", "deeplearning", "nlp", "computervision", "llms", "pandas", "numpy"],
    optionalSkills: ["r", "sql", "aws", "docker", "spark", "snowflake", "dataviz"],
    excludedSkills: ["reactjs", "figma", "userresearch", "css", "html", "selenium", "cypress", "playwright"],
    description: "Design and implement artificial intelligence systems, machine learning models, deep learning networks, natural language processing, LLMs, and data analysis using Python, PyTorch, and TensorFlow."
  },
  {
    name: "BI Specialist",
    aliases: ["bi specialist", "business intelligence specialist", "bi developer", "bi analyst", "data analyst", "tableau developer", "power bi developer"],
    coreSkills: ["sql", "tableau", "powerbi", "datawarehousing", "etl", "datamodeling", "dashboarddesign", "reporting"],
    optionalSkills: ["python", "excel", "snowflake", "postgres", "mysql"],
    excludedSkills: ["reactjs", "nodejs", "expressjs", "figma", "kubernetes", "docker", "selenium", "cypress", "playwright"],
    description: "Build business intelligence dashboards, reporting solutions, and data analytics architectures using SQL, ETL pipelines, Power BI, Tableau, and data warehousing solutions."
  }
];
