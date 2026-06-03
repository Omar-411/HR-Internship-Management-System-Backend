export const errors = {
  SHIFT_NAME_REQUIRED: {
    message: "Shift name is required",
    code: 400,
    errorCode: "SHIFT_NAME_REQUIRED",
    suggestion: "Provide a valid name for the shift",
  },
  SHIFT_TYPE_INVALID: {
    message: "Type must be 'single' or 'double'",
    code: 400,
    errorCode: "SHIFT_TYPE_INVALID",
    suggestion: "Set the type to either 'single' or 'double'",
  },
  SHIFT_PERIODS_REQUIRED: {
    message: "Periods array is required",
    code: 400,
    errorCode: "SHIFT_PERIODS_REQUIRED",
    suggestion: "Please provide the shift periods",
  },
  SHIFT_PERIODS_TYPE_MISMATCH: {
    message: "Shift type and periods count mismatch",
    code: 400,
    errorCode: "SHIFT_PERIODS_TYPE_MISMATCH",
    suggestion:
      "Ensure 'single' type has 1 period and 'double' type has 2 periods",
  },
  SPECIAL_SHIFT_TIME_FORMAT_INVALID: {
    message: "Invalid special shift time format",
    code: 400,
    errorCode: "SPECIAL_SHIFT_TIME_FORMAT_INVALID",
    suggestion: "Ensure all time values are in HH:MM format",
  },
};
