export const errors = {
  SUPERVISOR_NOT_ASSIGNED: {
    message: "Supervisor not assigned to the user.",
    code: 400,
    errorCode: "SUPERVISOR_NOT_ASSIGNED",
    suggestion:
      "Please contact HR to assign a supervisor to your account before submitting an alert.",
  },
  MISSING_FIELDS: {
    message: "Missing required fields.",
    code: 400,
    errorCode: "MISSING_FIELDS",
    suggestion:
      "Please ensure all required fields (recipientType, alertType, subject, description) are provided.",
  },
  INVALID_RECIPIENT_TYPE: {
    message: "Invalid recipient type.",
    code: 400,
    errorCode: "INVALID_RECIPIENT_TYPE",
    suggestion:
      "Recipient type must be either 'SUPERVISOR' or 'HR_DEPARTMENT'. Please correct the recipientType field.",
  },
  INVALID_ALERT_TYPE: {
    message: "Invalid alert type.",
    code: 400,
    errorCode: "INVALID_ALERT_TYPE",
    suggestion:
      "Alert type must be either 'TECHNICAL' or 'BEHAVIORAL'. Please correct the alertType field.",
  },
  EXCEEDS_MAX_LENGTH: {
    message: "Input exceeds maximum allowed length.",
    code: 400,
    errorCode: "EXCEEDS_MAX_LENGTH",
    suggestion:
      "Please ensure the subject does not exceed 200 characters and the description does not exceed 600 characters.",
  },
  ALERT_NOT_FOUND: {
    message: "Alert not found.",
    code: 404,
    errorCode: "ALERT_NOT_FOUND",
    suggestion: "Please provide a valid alert ID and try again.",
  },
  FORBIDDEN_ACTION: {
    message: "You are not allowed to perform this action.",
    code: 403,
    errorCode: "FORBIDDEN_ACTION",
    suggestion:
      "Only the authorized user(s) can perform this action.",
  },
  INVALID_STATUS: {
    message: "Only NEW alerts can be updated or deleted.",
    code: 400,
    errorCode: "INVALID_STATUS",
    suggestion:
      "You cannot modify nor delete an alert after it enters review.",
  },
  INVALID_STATUS_TRANSITION: {
    message: "Invalid status transition.",
    code: 400,
    errorCode: "INVALID_STATUS_TRANSITION",
    suggestion:
      "Only alerts in NEW status can be moved to UNDER_REVIEW. Please ensure the alert is in the correct status before updating.",
  },
  MISSING_RESOLUTION_NOTE: {
    message: "Resolution note is required for this action.",
    code: 400,
    errorCode: "MISSING_RESOLUTION_NOTE",
    suggestion: "A resolution note is required to dismiss this alert.",
  },
};
