/**
 * Custom application error with status code
 */
export class AppError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.status = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Centralized Express error handler
 */
export function errorHandler(error, _request, response, next) {
  if (response.headersSent) return next(error);

  const isProd = process.env.NODE_ENV === "production";

  // Zod validation errors (v4 uses error.issues)
  if (error.name === "ZodError" || Array.isArray(error.issues)) {
    return response.status(400).json({
      error: "Validation failed",
      details: error.issues?.map((issue) => ({
        path: issue.path?.join("."),
        message: issue.message
      }))
    });
  }

  // Mongoose CastError (invalid ObjectId)
  if (error.name === "CastError") {
    return response.status(400).json({
      error: `Invalid ${error.path}: ${error.value}`
    });
  }

  // Mongoose ValidationError
  if (error.name === "ValidationError" && error.errors) {
    const details = Object.entries(error.errors).map(([field, err]) => ({
      path: field,
      message: err.message
    }));
    return response.status(400).json({
      error: "Validation failed",
      details
    });
  }

  // MongoDB duplicate key error
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || "field";
    return response.status(409).json({
      error: `Duplicate value for ${field}`
    });
  }

  // JSON body-parser SyntaxError
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return response.status(400).json({
      error: "Invalid JSON body"
    });
  }

  // Custom AppError
  if (error instanceof AppError) {
    return response.status(error.status).json({
      error: error.message,
      ...(error.details && !isProd && { details: error.details })
    });
  }

  // Generic server error
  const status = error.status ?? 500;
  response.status(status).json({
    error: isProd ? "Internal server error" : error.message
  });
}
