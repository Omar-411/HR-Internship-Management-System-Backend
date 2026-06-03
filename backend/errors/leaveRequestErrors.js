export const errors = {
  LEAVE_REQUEST_NOT_FOUND: {
    message: "Leave request not found.",
    code: 404,
    errorCode: "LEAVE_REQUEST_NOT_FOUND",
    suggestion: "Verify the leave request ID and try again.",
  },
  INVALID_STATUS_PER_ROLE: {
    message: "The provided status is not valid for the user's role.",
    code: 400,
    errorCode: "INVALID_STATUS_PER_ROLE",
    suggestion: "Ensure the status is appropriate for the user's role.",
  },
  YEAR_REQUIRED: {
    message: "The year is required.",
    code: 400,
    errorCode: "YEAR_REQUIRED",
    suggestion: "Include the year in the request.",
  },
  MISSING_REQUIRED_FIELDS: {
    message: "Missing required fields for leave request creation.",
    code: 400,
    errorCode: "MISSING_REQUIRED_FIELDS",
    suggestion: "Ensure all required fields are included in the request body.",
  },
  INVALID_DATE_FORMAT: {
    message: "Invalid date format for startDate or endDate.",
    code: 400,
    errorCode: "INVALID_DATE_FORMAT",
    suggestion:
      "Ensure startDate and endDate are in a valid date format and that the end date is not before the start date.",
  },
  OVERLAPPING_LEAVE_REQUEST: {
    message: "You already have a leave request in this period.",
    code: 400,
    errorCode: "OVERLAPPING_LEAVE_REQUEST",
    suggestion: "Select a different date range for your leave request.",
  },
  UNAUTHORIZED_TO_SUBMIT_LEAVE_REQUEST: {
    message: "You are not authorized to submit a leave request.",
    code: 403,
    errorCode: "UNAUTHORIZED_TO_SUBMIT_LEAVE_REQUEST",
    suggestion: "Only employees and supervisors can submit leave requests.",
  },
  INELIGIBLE_FOR_LEAVE_TYPE: {
    message: "You are not eligible for this leave type.",
    code: 403,
    errorCode: "INELIGIBLE_FOR_LEAVE_TYPE",
    suggestion: "Review the eligibility criteria for the selected leave type.",
  },
  DURATION_EXCEEDS_ALLOWED: {
    message:
      "The duration of the leave request exceeds the allowed limit for this leave type.",
    code: 400,
    errorCode: "DURATION_EXCEEDS_ALLOWED",
    suggestion:
      "Ensure the duration of your leave request does not exceed the maximum allowed days for the selected leave type.",
  },
  INSUFFICIENT_LEAVE_BALANCE: {
    message: "You do not have enough leave balance for this request.",
    code: 400,
    errorCode: "INSUFFICIENT_LEAVE_BALANCE",
    suggestion:
      "Reduce the duration of your leave request or choose a different leave type.",
  },
  LEAVE_BALANCE_NOT_FOUND: {
    message: "Leave balance not found for the specified leave type.",
    code: 404,
    errorCode: "LEAVE_BALANCE_NOT_FOUND",
    suggestion: "Contact HR to resolve this issue.",
  },
  UNAUTHORIZED_TO_CANCEL_LEAVE_REQUEST: {
    message: "You are not authorized to cancel this leave request.",
    code: 403,
    errorCode: "UNAUTHORIZED_TO_CANCEL_LEAVE_REQUEST",
    suggestion: "You can only cancel your own leave requests.",
  },
  CANNOT_CANCEL_LEAVE_REQUEST: {
    message: "Cannot cancel this leave request anymore.",
    code: 400,
    errorCode: "CANNOT_CANCEL_LEAVE_REQUEST",
    suggestion:
      "You can only cancel leave requests that are still pending approval and have not been reviewed by an admin.",
  },
  UNAUTHORIZED_TO_UPDATE_LEAVE_REQUEST: {
    message: "You are not authorized to update this leave request.",
    code: 403,
    errorCode: "UNAUTHORIZED_TO_UPDATE_LEAVE_REQUEST",
    suggestion: "You can only update your own leave requests.",
  },
  UNAUTHORIZED_TO_VIEW_LEAVE_REQUEST: {
    message: "You are not authorized to view this leave request.",
    code: 403,
    errorCode: "UNAUTHORIZED_TO_VIEW_LEAVE_REQUEST",
    suggestion: "You can only view leave requests that you are involved in.",
  },
};
