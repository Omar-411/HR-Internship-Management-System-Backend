export const errors = {
  LEAVE_TYPE_NOT_FOUND: {
    message: "Leave type not found!",
    code: 404,
    errorCode: "LEAVE_TYPE_NOT_FOUND",
    suggestion: "Please check the leave type ID and try again.",
  },
  LEAVE_TYPE_ALREADY_EXISTS: {
    message: "Leave type with this name already exists!",
    code: 409,
    errorCode: "LEAVE_TYPE_ALREADY_EXISTS",
    suggestion: "Please choose a different name for the leave type.",
  },
  LEAVE_TYPE_NAME_REQUIRED: {
    message: "Leave type name is required!",
    code: 400,
    errorCode: "LEAVE_TYPE_NAME_REQUIRED",
    suggestion: "Please provide a name for the leave type.",
  },
  INVALID_DEFAULT_DAYS: {
    message: "Invalid default days value!",
    code: 400,
    errorCode: "INVALID_DEFAULT_DAYS",
    suggestion: "Default days must be a non-negative number.",
  },
  INVALID_GENDER: {
    message: "Invalid gender value!",
    code: 400,
    errorCode: "INVALID_GENDER",
    suggestion: "Gender must be one of the following: Male, Female, Both.",
  },
  LEAVE_TYPE_ARCHIVED: {
    message: "Cannot modify an archived leave type!",
    code: 400,
    errorCode: "LEAVE_TYPE_ARCHIVED",
    suggestion: "Please restore the leave type before making modifications.",
  },
  GENDER_REQUIRED_FOR_CHILD_BIRTH: {
    message: "Gender must be specified when the child birth requirement is true!",
    code: 400,
    errorCode: "GENDER_REQUIRED_FOR_CHILD_BIRTH",
    suggestion: "Please specify the gender eligibility for this leave type when it is related to childbirth.",
  },
  LEAVE_TYPE_ALREADY_ACTIVE: {
    message: "Leave type is already active!",
    code: 400,
    errorCode: "LEAVE_TYPE_ALREADY_ACTIVE",
    suggestion: "The leave type is already active. No need to restore it.",
  },
  INVALID_DEDUCT_FROM: {
    message: "Invalid deductFrom value!",
    code: 400,
    errorCode: "INVALID_DEDUCT_FROM",
    suggestion: "deductFrom must be one of the following: annual, maternity, paternity, sick, personal, none.",
  },
  INVALID_MAX_DAYS: {
    message: "Invalid max days value!",
    code: 400,
    errorCode: "INVALID_MAX_DAYS",
    suggestion: "Max days must be a non-negative number and greater than or equal to default days.",
  },
};
