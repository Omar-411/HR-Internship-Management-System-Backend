/**
 * Global Error Handling Middleware
 */
const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || "Error";

    // LOG THE FULL ERROR FOR DEBUGGING
    console.error(`[ERROR-LOG] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
    console.error(err);

    let errorResponse = {
        status: err.status,
        code: err.statusCode,
        message: err.message,
        errorCode: err.errorCode || "UNKNOWN_ERROR",
        suggestion: err.suggestion || "Please try again later or contact support.",
    };

    // 1. Handling Mongoose Validation Errors
    if (err.name === "ValidationError") {
        const messages = Object.values(err.errors).map((el) => el.message);
        errorResponse.message = "Data validation failed.";
        errorResponse.details = messages;
        errorResponse.suggestion = "Verify that all required fields are correctly filled.";
        err.statusCode = 400;
    }

    // 2. Handling Mongoose Duplicate Key Errors
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        errorResponse.message = `This ${field} is already in use.`;
        errorResponse.suggestion = `Please use a different ${field}.`;
        err.statusCode = 400;
    }

    // 3. Handling Mongoose Cast Errors (Invalid IDs)
    if (err.name === "CastError") {
        errorResponse.message = `Invalid format for field: ${err.path}`;
        errorResponse.suggestion = "Please check the ID or value provided in the request.";
        err.statusCode = 400;
    }

    // 4. Handling JWT Errors
    if (err.name === "JsonWebTokenError") {
        errorResponse.message = "Invalid session or security token.";
        errorResponse.suggestion = "Please log in again to refresh your session.";
        err.statusCode = 401;
    }

    if (err.name === "TokenExpiredError") {
        errorResponse.message = "Your session has expired.";
        errorResponse.suggestion = "Please log in again.";
        err.statusCode = 401;
    }

    // 5. Handling JSON Syntax Errors (Invalid JSON in body)
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        errorResponse.message = "The request contains invalid data format (JSON).";
        errorResponse.suggestion = "Ensure your request body is valid JSON.";
        err.statusCode = 400;
    }

    // If in development/test, include the stack trace for easier debugging
    if (process.env.NODE_ENV !== "production") {
        errorResponse.originalError = err.message;
    }

    res.status(err.statusCode).json(errorResponse);
};

export default errorHandler;
