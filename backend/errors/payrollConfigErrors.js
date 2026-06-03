export const errors = {
  PAYROLL_CONFIG_NOT_FOUND: {
    message: "No active payroll configuration found for the specified year.",
    code: 404,
    errorCode: "PAYROLL_CONFIG_NOT_FOUND",
    suggestion:
      "Please create and activate a payroll configuration for the specified year before generating payrolls.",
  },
  ACTIVE_PAYROLL_CONFIG_EXISTS: {
    message: "An active payroll configuration already exists for this year.",
    code: 409,
    errorCode: "ACTIVE_PAYROLL_CONFIG_EXISTS",
    suggestion:
      "Please deactivate the existing configuration for this year before creating a new one, or update the existing configuration instead.",
  },
  INVALID_RATE: {
    message: "Invalid rate value.",
    code: 400,
    errorCode: "INVALID_RATE",
    suggestion: "Rate must be a number between 0 and 1.",
  },
  INVALID_YEAR: {
    message: "Invalid year value.",
    code: 400,
    errorCode: "INVALID_YEAR",
    suggestion: "Year must be a number greater than or equal to 2000.",
  },
  INVALID_CNSS_CEILING: {
    message: "Invalid CNSS ceiling value.",
    code: 400,
    errorCode: "INVALID_CNSS_CEILING",
    suggestion: "CNSS ceiling must be a number greater than or equal to 0.",
  },
  INVALID_CSS_THRESHOLD: {
    message: "Invalid CSS threshold value.",
    code: 400,
    errorCode: "INVALID_CSS_THRESHOLD",
    suggestion: "Threshold must be a number greater than or equal to 0.",
  },
  INVALID_IRPP_BRACKETS: {
    message: "Invalid IRPP brackets.",
    code: 400,
    errorCode: "INVALID_IRPP_BRACKETS",
    suggestion:
      "IRPP brackets must be a non-empty array of { limit, rate } objects.",
  },
  INVALID_BRACKET_LIMIT: {
    message: "Invalid IRPP bracket limit.",
    code: 400,
    errorCode: "INVALID_BRACKET_LIMIT",
    suggestion: "Each IRPP bracket limit must be a number greater than 0.",
  },
  INVALID_BRACKET_ORDER: {
    message: "Invalid IRPP bracket order.",
    code: 400,
    errorCode: "INVALID_BRACKET_ORDER",
    suggestion: "IRPP brackets must be in strictly increasing order of limits.",
  },
  INVALID_MAX_CHILDREN: {
    message: "Invalid maxChildren value in family deductions.",
    code: 400,
    errorCode: "INVALID_MAX_CHILDREN",
    suggestion: "maxChildren must be a number greater than or equal to 0.",
  },
  INVALID_MONTHLY_HOURS: {
    message: "Invalid standard monthly hours value.",
    code: 400,
    errorCode: "INVALID_MONTHLY_HOURS",
    suggestion: "Standard monthly hours must be a number greater than 0.",
  },
  INVALID_FRAIS_PRO_CEILING: {
    message: "Invalid ceiling value for frais professionnels.",
    code: 400,
    errorCode: "INVALID_FRAIS_PRO_CEILING",
    suggestion: "Ceiling for frais professionnels must be a number greater than or equal to 0.",
  },
  INVALID_SPOUSE_AMOUNT: {
    message: "Invalid deduction amount for spouse.",
    code: 400,
    errorCode: "INVALID_SPOUSE_AMOUNT",
    suggestion: "Deduction amount for spouse must be a number greater than or equal to 0.",
  },
  INVALID_PER_CHILD_AMOUNT: {
    message: "Invalid deduction amount per child.",
    code: 400,
    errorCode: "INVALID_PER_CHILD_AMOUNT",
    suggestion: "Deduction amount per child must be a number greater than or equal to 0.",
  },
  INVALID_STUDENT_CHILD_AMOUNT: {
    message: "Invalid deduction amount for student child.",
    code: 400,
    errorCode: "INVALID_STUDENT_CHILD_AMOUNT",
    suggestion: "Deduction amount for student child must be a number greater than or equal to 0.",
  },
  INVALID_DISABLED_CHILD_AMOUNT: {
    message: "Invalid deduction amount for disabled child.",
    code: 400,
    errorCode: "INVALID_DISABLED_CHILD_AMOUNT",
    suggestion: "Deduction amount for disabled child must be a number greater than or equal to 0.",
  },
};
