export const errors = {
  NO_TOKEN_PROVIDED: {
    message: "No Token provided!",
    code: 401,
    errorCode: "NO_TOKEN_PROVIDED",
    suggestion: "Please provide a token.",
  },
  INVALID_OR_EXPIRED_TOKEN: {
    message: "Invalid or Expired token!",
    code: 401,
    errorCode: "INVALID_OR_EXPIRED_TOKEN",
    suggestion: "Please provide a valid token or log in again.",
  },
  UNAUTHORIZED: {
    message: "Unauthorized!",
    code: 403,
    errorCode: "UNAUTHORIZED",
    suggestion: "You do not have permission to access the ressource.",
  },
  SERVER_ERROR: {
    message: "Server error",
    code: 500,
    errorCode: "SERVER_ERROR",
    suggestion: "An unexpected error occurred. Please try again later.",
  },
};
