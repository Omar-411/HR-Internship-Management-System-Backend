export const errors = {
  RESIGNATION_REQUEST_NOT_FOUND: {
    message: "Resignation request not found.",
    code: 404,
    errorCode: "RESIGNATION_REQUEST_NOT_FOUND",
    suggestion: "Please check the resignation request ID and try again.",
  },
  RESIGNATION_ALREADY_EXISTS: {
    message: "This employee already has an active resignation request.",
    code: 409,
    errorCode: "RESIGNATION_ALREADY_EXISTS",
    suggestion: "Please resolve the existing resignation request before submitting a new one.",
  },
  INVALID_RESIGNATION_REASON: {
    message: "Invalid reason for resignation.",
    code: 400,
    errorCode: "INVALID_RESIGNATION_REASON",
    suggestion: "Please provide a valid reason for resignation.",
  },
  UNAUTHORIZED_ACTION: {
    message: "You are not authorized to perform this action.",
    code: 403,
    errorCode: "UNAUTHORIZED_ACTION",
    suggestion: "Only the users with access can perform this action.",
  },
  INVALID_STATUS_UPDATE: {
    message: "Invalid status update.",
    code: 400,
    errorCode: "INVALID_STATUS_UPDATE",
    suggestion: "You can only update the resignation request if its status is still 'submitted'.",
  },
  INVALID_CLARIFICATION_MESSAGE: {
    message: "Clarification message cannot be empty.",
    code: 400,
    errorCode: "INVALID_CLARIFICATION_MESSAGE",
    suggestion: "Please provide a valid clarification message.",
  },
  RESIGNATION_ALREADY_PROCESSED: {
    message: "This resignation request has either been processed or not found.",
    code: 400,
    errorCode: "RESIGNATION_ALREADY_PROCESSED",
    suggestion: "Only resignation requests with 'submitted' status can be processed.",
  },
  INVALID_CLARIFICATION_RESPONSE: {
    message: "Clarification response cannot be empty.",
    code: 400,
    errorCode: "INVALID_CLARIFICATION_RESPONSE",
    suggestion: "Please provide a valid clarification response.",
  },
};
