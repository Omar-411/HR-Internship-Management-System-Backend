export const errors = {
  MEETING_NOT_FOUND: {
    message: "Meeting not found.",
    code: 404,
    errorCode: "MEETING_NOT_FOUND",
    suggestion: "Please provide a valid meeting ID.",
  },
  MEETING_OR_ATTENDEE_NOT_FOUND: {
    message: "Meeting or attendee not found.",
    code: 404,
    errorCode: "MEETING_OR_ATTENDEE_NOT_FOUND",
    suggestion: "Please provide a valid meeting ID and ensure you are an attendee.",
  },
  UNAUTHORIZED_TO_CREATE_MEETING: {
    message: "Only the Product Owner can create meetings for this project.",
    code: 403,
    errorCode: "UNAUTHORIZED_TO_CREATE_MEETING",
    suggestion:
      "Please contact the Product Owner to create meetings for this project.",
  },
  UNAUTHORIZED_TO_UPDATE_MEETING: {
    message: "Only the Product Owner can update meetings for this project.",
    code: 403,
    errorCode: "UNAUTHORIZED_TO_UPDATE_MEETING",
    suggestion:
      "Please contact the Product Owner to update meetings for this project.",
  },
  INVALID_TIME_RANGE: {
    message: "The meeting end time must be after the start time.",
    code: 400,
    errorCode: "INVALID_TIME_RANGE",
    suggestion: "Please provide a valid time range for the meeting.",
  },
  MEETING_LINK_REQUIRED: {
    message: "Meeting link is required for online meetings.",
    code: 400,
    errorCode: "MEETING_LINK_REQUIRED",
    suggestion: "Please provide a meeting link for online meetings.",
  },
  MEETING_ADDRESS_REQUIRED: {
    message: "Meeting address is required for physical meetings.",
    code: 400,
    errorCode: "MEETING_ADDRESS_REQUIRED",
    suggestion: "Please provide a meeting address for physical meetings.",
  },
  INVALID_ATTENDEES: {
    message: "Some attendees are not valid team members.",
    code: 400,
    errorCode: "INVALID_ATTENDEES",
    suggestion: "Please provide valid attendees who are part of the project team.",
  },
  PAST_MEETING_UPDATE: {
    message: "Cannot update meetings that have already occurred.",
    code: 400,
    errorCode: "PAST_MEETING_UPDATE",
    suggestion: "Please provide a valid meeting ID for an upcoming meeting.",
  },
  INVALID_RESPONSE_STATUS: {
    message: "Invalid response status. Must be 'Accepted', 'Rejected'.",
    code: 400,
    errorCode: "INVALID_RESPONSE_STATUS",
    suggestion:
      "Please provide a valid response status: 'Accepted', 'Rejected'.",
  },
  REJECTION_REASON_REQUIRED: {
    message: "Rejection reason is required when rejecting a meeting invitation.",
    code: 400,
    errorCode: "REJECTION_REASON_REQUIRED",
    suggestion:
      "Please provide a reason for rejecting the meeting invitation.",
  },
  ALREADY_RESPONDED: {
    message: "You have already responded to this meeting invitation.",
    code: 400,
    errorCode: "ALREADY_RESPONDED",
    suggestion: "You cannot respond to the same meeting invitation multiple times.",
  },
  PAST_MEETING_RESPONSE: {
    message: "Cannot respond to past meeting.",
    code: 400,
    errorCode: "PAST_MEETING_RESPONSE",
    suggestion: "Please provide a valid meeting ID for an upcoming meeting.",
  },
  UNAUTHORIZED_TO_CANCEL_MEETING: {
    message: "Only the Product Owner can cancel meetings for this project.",
    code: 403,
    errorCode: "UNAUTHORIZED_TO_CANCEL_MEETING",
    suggestion:
      "Please contact the Product Owner to cancel meetings for this project.",
  },
  MEETING_ALREADY_CANCELLED: {
    message: "This meeting has already been cancelled.",
    code: 400,
    errorCode: "MEETING_ALREADY_CANCELLED",
    suggestion: "This meeting is already cancelled. No further action is needed.",
  },
  PAST_MEETING_CANCEL: {
    message: "Cannot cancel meetings that have already occurred.",
    code: 400,
    errorCode: "PAST_MEETING_CANCEL",
    suggestion: "Please provide a valid meeting ID for an upcoming meeting.",
  },
  UNAUTHORIZED_TO_ACCESS_MEETING: {
    message: "You are not authorized to access this meeting.",
    code: 403,
    errorCode: "UNAUTHORIZED_TO_ACCESS_MEETING",
    suggestion: "Please ensure you are an attendee of this meeting.",
  },
  INVALID_REMINDER: {
    message: "Invalid reminder time value.",
    code: 400,
    errorCode: "INVALID_REMINDER",
    suggestion: "Please provide a valid reminder time value.",
  },
};
