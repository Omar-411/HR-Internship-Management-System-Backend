export const errors = {
  TIMETABLE_NOT_FOUND: {
    message: "Timetable not found",
    code: 404,
    errorCode: "TIMETABLE_NOT_FOUND",
    suggestion: "Please check the validity of the timetable.",
  },
  MISSING_REQUIRED_FIELDS: {
    message: "Missing required parameters",
    code: 400,
    errorCode: "MISSING_REQUIRED_FIELDS",
    suggestion: "Please provide all the required fields.",
  },
  INVALID_DATE: {
    message: "Invalid date format for year or month",
    code: 400,
    errorCode: "INVALID_DATE",
    suggestion: "Please ensure year and month are valid numbers.",
  },
  LOCATION_REQUIRED: {
    message: "Location is required for working shifts",
    code: 400,
    errorCode: "LOCATION_REQUIRED",
    suggestion: "Please provide a location.",
  },
  INVALID_LOCATION: {
    message: "Invalid location",
    code: 400,
    errorCode: "INVALID_LOCATION",
    suggestion: "Invalid location! Must be 'Remote' or 'Onsite'",
  },
  INVALID_SHIFT_TYPE: {
    message: "Invalid shift type",
    code: 400,
    errorCode: "INVALID_SHIFT_TYPE",
    suggestion: "Please provide a valid shift type.",
  },
  SPECIAL_SHIFT_DATES_REQUIRED: {
    message: "Dates are required for Special Shift type",
    code: 400,
    errorCode: "SPECIAL_SHIFT_DATES_REQUIRED",
    suggestion: "Please provide dates for Special Shift type.",
  },
  INVALID_SPECIAL_SHIFT_DATES: {
    message: "Invalid startTime or endTime for Special Shift",
    code: 400,
    errorCode: "INVALID_SPECIAL_SHIFT_DATES",
    suggestion: "StartTime and endTime must be in HH:mm format.",
  },
  UNAUTHORIZED_TO_ACCESS_TIMETABLE: {
    message: "Unauthorized to access this timetable",
    code: 403,
    errorCode: "UNAUTHORIZED_TO_ACCESS_TIMETABLE",
    suggestion: "You do not have permission to access this timetable.",
  },
};
