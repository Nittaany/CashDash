import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "./errorHandler.js";

/**
 * JWT authentication middleware
 * Verifies Authorization: Bearer <token> and sets req.user
 */
export function authenticate(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new AppError(401, "Authentication required");
    }

    const token = authHeader.slice(7);
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ["HS256"]
    });

    req.user = {
      userId: payload.userId,
      email: payload.email,
      isDemo: payload.isDemo ?? false
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return next(new AppError(401, "Invalid or expired token"));
    }
    next(error);
  }
}

/**
 * Middleware to block demo users from certain actions
 */
export function blockDemoUser(req, _res, next) {
  if (req.user?.isDemo) {
    return next(new AppError(403, "Demo users cannot modify their profile"));
  }
  next();
}
