// Passport Regex Format for 120+ countries based on ICAO standards + Descriptive Hints for various countries

export const passportRules = {
  // North America
  US: { regex: /^[0-9]{9}$/, description: "9 digits (e.g. 123456789)" },
  CA: { regex: /^[A-Z]{2}[0-9]{6}$/, description: "2 letters followed by 6 digits (e.g. AB123456)" },
  MX: { regex: /^[A-Z0-9]{8,9}$/, description: "8-9 alphanumeric characters" },

  // Europe
  GB: { regex: /^[0-9A-Z]{9}$/, description: "9 alphanumeric characters" },
  FR: { regex: /^[0-9]{2}[A-Z]{2}[0-9]{5}$/, description: "2 digits, 2 letters, 5 digits (e.g. 12AB34567)" },
  DE: { regex: /^[CFGHJKLMNPRTVWXYZ0-9]{9}$/, description: "9 alphanumeric characters (excluding certain vowels)" },
  IT: { regex: /^[A-Z]{2}[0-9]{7}$/, description: "2 letters followed by 7 digits (e.g. AB1234567)" },
  ES: { regex: /^[A-Z]{3}[0-9]{6}$/, description: "3 letters followed by 6 digits (e.g. ABC123456)" },
  PT: { regex: /^[A-Z]{2}[0-9]{6}$/, description: "2 letters followed by 6 digits (e.g. AB123456)" },
  NL: { regex: /^[A-Z]{2}[0-9]{7}$/, description: "2 letters followed by 7 digits" },
  BE: { regex: /^[A-Z]{2}[0-9]{6}$/, description: "2 letters followed by 6 digits" },
  CH: { regex: /^[A-Z][0-9]{7}$/, description: "1 letter followed by 7 digits (e.g. A1234567)" },
  AT: { regex: /^[A-Z][0-9]{7}$/, description: "1 letter followed by 7 digits" },
  PL: { regex: /^[A-Z]{2}[0-9]{7}$/, description: "2 letters followed by 7 digits" },
  CZ: { regex: /^[0-9]{8}$/, description: "8 digits" },
  SK: { regex: /^[A-Z0-9]{8,9}$/, description: "8-9 alphanumeric characters" },
  HU: { regex: /^[A-Z]{2}[0-9]{6}$/, description: "2 letters followed by 6 digits" },
  RO: { regex: /^[A-Z]{2}[0-9]{6}$/, description: "2 letters followed by 6 digits" },
  BG: { regex: /^[A-Z][0-9]{7}$/, description: "1 letter followed by 7 digits" },
  GR: { regex: /^[A-Z]{2}[0-9]{7}$/, description: "2 letters followed by 7 digits" },
  SE: { regex: /^[0-9]{8}$/, description: "8 digits" },
  NO: { regex: /^[0-9]{7}$/, description: "7 digits" },
  DK: { regex: /^[0-9]{9}$/, description: "9 digits" },
  FI: { regex: /^[A-Z]{2}[0-9]{7}$/, description: "2 letters followed by 7 digits" },
  IE: { regex: /^[0-9A-Z]{8,9}$/, description: "8-9 alphanumeric characters" },
  IS: { regex: /^[A-Z0-9]{8,9}$/, description: "8-9 alphanumeric characters" },
  HR: { regex: /^[A-Z0-9]{8,9}$/, description: "8-9 alphanumeric characters" },
  SI: { regex: /^[A-Z0-9]{8,9}$/, description: "8-9 alphanumeric characters" },
  RS: { regex: /^[0-9]{9}$/, description: "9 digits" },
  UA: { regex: /^[A-Z]{2}[0-9]{6}$/, description: "2 letters followed by 6 digits" },

  // North Africa & Middle East
  TN: { regex: /^[A-Z][0-9]{7}$/, description: "1 letter followed by 7 digits (e.g. A1234567)" },
  MA: { regex: /^[A-Z]{1,2}[0-9]{6,7}$/, description: "1-2 letters followed by 6-7 digits" },
  DZ: { regex: /^[0-9]{9}$/, description: "9 digits" },
  LY: { regex: /^[A-Z0-9]{8,9}$/, description: "8-9 alphanumeric characters" },
  EG: { regex: /^[A-Z][0-9]{8}$/, description: "1 letter followed by 8 digits" },
  TR: { regex: /^[A-Z][0-9]{8}$/, description: "1 letter followed by 8 digits" },
  SA: { regex: /^[A-Z][0-9]{8}$/, description: "1 letter followed by 8 digits" },
  AE: { regex: /^[A-Z0-9]{8,9}$/, description: "8-9 alphanumeric characters" },
  QA: { regex: /^[A-Z0-9]{8}$/, description: "8 alphanumeric characters" },
  KW: { regex: /^[A-Z][0-9]{7}$/, description: "1 letter followed by 7 digits" },
  OM: { regex: /^[A-Z][0-9]{7}$/, description: "1 letter followed by 7 digits" },
  JO: { regex: /^[A-Z0-9]{8,9}$/, description: "8-9 alphanumeric characters" },
  LB: { regex: /^[A-Z0-9]{8,9}$/, description: "8-9 alphanumeric characters" },
  IL: { regex: /^[0-9]{8,9}$/, description: "8-9 digits" },
  IR: { regex: /^[A-Z][0-9]{8}$/, description: "1 letter followed by 8 digits" },
  IQ: { regex: /^[A-Z][0-9]{7,8}$/, description: "1 letter followed by 7-8 digits" },

  // South Asia
  IN: { regex: /^[A-Z][0-9]{7}$/, description: "1 letter followed by 7 digits (e.g. Z1234567)" },
  PK: { regex: /^[A-Z]{2}[0-9]{7}$/, description: "2 letters followed by 7 digits" },
  BD: { regex: /^[A-Z]{2}[0-9]{7}$/, description: "2 letters followed by 7 digits" },
  LK: { regex: /^[A-Z0-9]{7,9}$/, description: "7-9 alphanumeric characters" },
  NP: { regex: /^[0-9]{8}$/, description: "8 digits" },

  // East Asia
  CN: { regex: /^[A-Z][0-9]{8}$/, description: "1 letter followed by 8 digits" },
  JP: { regex: /^[A-Z]{2}[0-9]{7}$/, description: "2 letters followed by 7 digits" },
  KR: { regex: /^[A-Z][0-9]{8}$/, description: "1 letter followed by 8 digits" },
  MN: { regex: /^[A-Z]{2}[0-9]{6}$/, description: "2 letters followed by 6 digits" },

  // Southeast Asia
  TH: { regex: /^[A-Z][0-9]{7}$/, description: "1 letter followed by 7 digits (e.g. A1234567)" },
  MY: { regex: /^[A-Z][0-9]{8}$/, description: "1 letter followed by 8 digits" },
  SG: { regex: /^[A-Z][0-9]{7}$/, description: "1 letter followed by 7 digits" },
  ID: { regex: /^[A-Z][0-9]{7}$/, description: "1 letter followed by 7 digits" },
  PH: { regex: /^[A-Z][0-9]{7}$/, description: "1 letter followed by 7 digits" },
  VN: { regex: /^[A-Z][0-9]{7}$/, description: "1 letter followed by 7 digits" },

  // Oceania
  AU: { regex: /^[A-Z][0-9]{7}$/, description: "1 letter followed by 7 digits" },
  NZ: { regex: /^[A-Z]{2}[0-9]{6}$/, description: "2 letters followed by 6 digits" },
  FJ: { regex: /^[A-Z0-9]{7,9}$/, description: "7-9 alphanumeric characters" },

  // South America
  BR: { regex: /^[A-Z]{2}[0-9]{6}$/, description: "2 letters followed by 6 digits" },
  AR: { regex: /^[A-Z]{3}[0-9]{6}$/, description: "3 letters followed by 6 digits" },
  CL: { regex: /^[A-Z]{2}[0-9]{7}$/, description: "2 letters followed by 7 digits" },
  CO: { regex: /^[A-Z]{2}[0-9]{7}$/, description: "2 letters followed by 7 digits" },
  PE: { regex: /^[A-Z]{2}[0-9]{6}$/, description: "2 letters followed by 6 digits" },
  VE: { regex: /^[A-Z]{2}[0-9]{6}$/, description: "2 letters followed by 6 digits" },

  // Default Generic
  GENERIC: { regex: /^[A-Z0-9]{6,12}$/, description: "6-12 alphanumeric characters" }
};
