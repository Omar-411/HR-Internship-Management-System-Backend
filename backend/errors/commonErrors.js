// Common errors accross the app
export const errors = {
  RESOURCE_NOT_FOUND: {
    message: "Resource not found",
    code: 404,
    errorCode: "RESOURCE_NOT_FOUND",
    suggestion: "Please check the existence of the resource.",
  },
  USER_NOT_FOUND: {
    message: "User(s) not found",
    code: 404,
    errorCode: "USER_NOT_FOUND",
    suggestion: "Please check the existence of the user(s).",
  },
  USER_UNAVAILABLE: {
    message: "User(s) unavailable to take on a new project",
    code: 400,
    errorCode: "USER_UNAVAILABLE",
    suggestion: "User(s) already involved in 2 active projects.",
  },
  NO_FILE_UPLOADED: {
    message: "No file uploaded",
    code: 400,
    errorCode: "NO_FILE_UPLOADED",
    suggestion: "Please upload a file.",
  },
  DOCUMENT_NOT_FOUND: {
    message: "Document not found",
    code: 404,
    errorCode: "DOCUMENT_NOT_FOUND",
    suggestion: "Please check the validity of the document.",
  },
};
