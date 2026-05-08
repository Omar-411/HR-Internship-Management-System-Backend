export const errors = {
  PERSONAL_TYPE_NOT_FOUND: {
    message: "Personal document type not found",
    code: 404,
    errorCode: "PERSONAL_TYPE_NOT_FOUND",
    suggestion: "Please ensure the Personal document type exists.",
  },
  NOT_PERSONAL_DOCUMENT: {
    message: "This is not a personal document",
    code: 400,
    errorCode: "NOT_PERSONAL_DOCUMENT",
    suggestion: "Please provide a valid personal document.",
  },
  NOT_ADMINISTRATIVE_DOCUMENT: {
    message: "This is not an administrative document",
    code: 400,
    errorCode: "NOT_ADMINISTRATIVE_DOCUMENT",
    suggestion: "Please provide a valid administrative document.",
  },
  DUPLICATE_FILE: {
    message: "You have already uploaded this exact document",
    code: 409,
    errorCode: "DUPLICATE_FILE",
    suggestion: "Please upload a different file.",
  },
  FETCH_FAILED: {
    message: "Failed to fetch a document",
    code: 500,
    errorCode: "FETCH_FAILED",
    suggestion: "Please try again later.",
  },
  NOT_A_PROJECT_DOCUMENT: {
    message: "This document is not associated with any project",
    code: 400,
    errorCode: "NOT_A_PROJECT_DOCUMENT",
    suggestion: "Please provide a valid project document.",
  },
  UNAUTHORIZED_ACCESS: {
    message: "You are not authorized to access this document",
    code: 403,
    errorCode: "UNAUTHORIZED_ACCESS",
    suggestion: "You are not allowed to access this document.",
  },
  UNAUTHORIZED_TO_DELETE_DOCUMENT: {
    message: "You are not authorized to delete this document",
    code: 403,
    errorCode: "UNAUTHORIZED_TO_DELETE_DOCUMENT",
    suggestion: "You are not allowed to delete this document.",
  },
  UNKNOWN_TEMPLATE_TYPE: {
    message: "Unknown template type",
    code: 400,
    errorCode: "UNKNOWN_TEMPLATE_TYPE",
    suggestion: "Please provide a valid template type.",
  },
};
