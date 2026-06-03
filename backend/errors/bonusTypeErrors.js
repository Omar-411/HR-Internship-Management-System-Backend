export const errors = {
  BONUS_TYPE_NOT_FOUND: {
    message: "Bonus type not found.",
    code: 404,
    errorCode: "BONUS_TYPE_NOT_FOUND",
    suggestion: "Please check the bonus type ID and try again.",
  },
  BONUS_TYPE_CODE_EXISTS: {
    message: "A bonus type with this code already exists.",
    code: 409,
    errorCode: "BONUS_TYPE_CODE_EXISTS",
    suggestion: "Please use a unique code for the bonus type.",
  },
  BONUS_TYPE_NAME_REQUIRED: {
    message: "Bonus type name is required.",
    code: 400,
    errorCode: "BONUS_TYPE_NAME_REQUIRED",
    suggestion: "Please provide a valid name for the bonus type.",
  },
  BONUS_TYPE_INVALID_DEFAULT_AMOUNT: {
    message: "Default amount for the bonus type must be a non-negative number.",
    code: 400,
    errorCode: "BONUS_TYPE_INVALID_DEFAULT_AMOUNT",
    suggestion:
      "Please provide a valid non-negative number for the default amount.",
  },
  BONUS_TYPE_MISSING_FIELDS: {
    message: "Required fields for bonus type are missing.",
    code: 400,
    errorCode: "BONUS_TYPE_MISSING_FIELDS",
    suggestion: "Please provide all required fields for the bonus type.",
  },
};
