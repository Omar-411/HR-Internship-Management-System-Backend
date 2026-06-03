export const errors = {
  ALLOWANCE_TYPE_NAME_REQUIRED: {
    message: "Allowance type name is required.",
    code: 400,
    errorCode: "ALLOWANCE_TYPE_NAME_REQUIRED",
    suggestion: "Please provide a valid name for the allowance type.",
  },
  ALLOWANCE_TYPE_CODE_EXISTS: {
    message: "An allowance type with this code already exists.",
    code: 409,
    errorCode: "ALLOWANCE_TYPE_CODE_EXISTS",
    suggestion: "Please use a unique code for the allowance type.",
  },
  ALLOWANCE_TYPE_INVALID_DEFAULT_AMOUNT: {
    message:
      "Default amount for the allowance type must be a non-negative number.",
    code: 400,
    errorCode: "ALLOWANCE_TYPE_INVALID_DEFAULT_AMOUNT",
    suggestion:
      "Please provide a valid non-negative number for the default amount.",
  },
  ALLOWANCE_TYPE_NOT_FOUND: {
    message: "Allowance type not found.",
    code: 404,
    errorCode: "ALLOWANCE_TYPE_NOT_FOUND",
    suggestion: "Please check the allowance type ID and try again.",
  },
  ALLOWANCE_TYPE_MISSING_FIELDS: {
    message: "Required fields for allowance type are missing.",
    code: 400,
    errorCode: "ALLOWANCE_TYPE_MISSING_FIELDS",
    suggestion: "Please provide all required fields for the allowance type.",
  },
};
