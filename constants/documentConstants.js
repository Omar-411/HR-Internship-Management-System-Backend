// Mapping of document types to their corresponding template categories (used for document generation)
export const TEMPLATE_DOCUMENT_TYPES = {
  "employment_certificate": "Certificate",
  "intern_certificate": "Certificate",
  "recommandation_letter": "Certificate",

  "intern_contract": "Contract",
  "cdi_contract": "Contract",
  "cdd_contract": "Contract",

  "monthly_payslip": "Report",
};

// Template role allowlist — defines which roles can use each template
export const TEMPLATE_ROLE_ALLOWLIST = {
  intern_certificate: ["intern"],
  employment_certificate: ["employee", "supervisor"],
  recommandation_letter: ["intern", "employee", "supervisor", "admin"],
  monthly_payslip: ["employee", "supervisor"],
};

// The path to the Chrome executable for Puppeteer (used for document generation)
export const CHROME_PATH =
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
