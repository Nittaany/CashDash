import { createHmac, randomBytes } from "node:crypto";
import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

const DEVICE_COOKIE_NAME = "cashdash_device";
const DEVICE_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createAuthRateLimiter({
  windowMs,
  limit,
  message,
  keyGenerator,
  skipInTest = true
}) {
  const relaxedInTest = env.NODE_ENV === "test" && skipInTest;
  const options = {
    windowMs,
    limit: relaxedInTest ? 1000 : limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message
  };

  if (keyGenerator) options.keyGenerator = keyGenerator;
  if (relaxedInTest) options.skip = () => true;

  return rateLimit(options);
}

function hmacRateLimitKey(scope, value) {
  return createHmac("sha256", env.JWT_REFRESH_SECRET)
    .update(`${scope}\0${value}`)
    .digest("hex");
}

export function authEmailRateLimitKey(email) {
  if (typeof email !== "string" || !email.trim()) {
    throw new TypeError("A validated email is required for the auth email limiter");
  }

  return hmacRateLimitKey("auth-email", email.trim().toLowerCase());
}

export function authDeviceRateLimitKey(deviceId) {
  if (typeof deviceId !== "string" || !deviceId) {
    throw new TypeError("An auth device ID is required for the device limiter");
  }

  return hmacRateLimitKey("auth-device", deviceId);
}

export function ensureAuthDeviceId(req, res, next) {
  const existingDeviceId = req.cookies?.[DEVICE_COOKIE_NAME];
  const authDeviceId =
    typeof existingDeviceId === "string" && DEVICE_ID_PATTERN.test(existingDeviceId)
      ? existingDeviceId
      : randomBytes(32).toString("base64url");

  req.authDeviceId = authDeviceId;

  if (authDeviceId !== existingDeviceId) {
    res.cookie(DEVICE_COOKIE_NAME, authDeviceId, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: "/api/auth",
      maxAge: DEVICE_COOKIE_MAX_AGE
    });
  }

  next();
}

/**
 * Rate limiter for auth endpoints
 * Relaxed in test environment
 */
export const authRateLimiter = createAuthRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  message: { error: "Too many requests, please try again later" }
});

/**
 * Rate limiter for demo login (slightly more generous)
 */
export const demoRateLimiter = createAuthRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 5,
  message: { error: "Too many demo login attempts" }
});

export const authEmailRateLimiter = createAuthRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  message: { error: "Too many email requests, please try again later" },
  keyGenerator: (req) => authEmailRateLimitKey(req.validated?.body?.email)
});

export const authDeviceRateLimiter = createAuthRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { error: "Too many signup or resend requests, please try again later" },
  keyGenerator: (req) => authDeviceRateLimitKey(req.authDeviceId)
});
