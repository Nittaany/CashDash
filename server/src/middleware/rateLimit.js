import rateLimit from "express-rate-limit";

/**
 * Rate limiter for auth endpoints
 * Relaxed in test environment
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: process.env.NODE_ENV === "test" ? 1000 : 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
  skip: () => process.env.NODE_ENV === "test"
});

/**
 * Rate limiter for demo login (slightly more generous)
 */
export const demoRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: process.env.NODE_ENV === "test" ? 1000 : 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many demo login attempts" },
  skip: () => process.env.NODE_ENV === "test"
});
