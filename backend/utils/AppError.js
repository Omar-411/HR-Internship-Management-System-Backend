/**
 * Custom Error class for operational errors.
 * These are errors we can predict and handle gracefully.
 */
class AppError extends Error {
  constructor(message, statusCode, errorCode = null, suggestion = null) {
    // The error message
    super(message);

    // HTTP status code (ex: 400, 404, 500)
    this.statusCode = statusCode;

    this.status = `${statusCode}`.startsWith("4") ? "Fail" : "Error"; 

    // Mark the error as expected and handled (Not unexpected bugs)
    this.isOperational = true;

    // A custom error code per situation (ex: "USER_NOT_FOUND", "VALIDATION_ERROR")
    this.errorCode = errorCode;

    // An optional suggestion to help resolve the error
    this.suggestion = suggestion;
  }
}

export default AppError;
