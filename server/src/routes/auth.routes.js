import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { z } from "zod";
import { env } from "../config/env.js";
import User from "../models/User.js";
import { AppError } from "../middleware/errorHandler.js";
import { validate } from "../middleware/validate.js";
import { authenticate, blockDemoUser } from "../middleware/auth.js";
import { authRateLimiter, demoRateLimiter } from "../middleware/rateLimit.js";
import { createEphemeralDemoUser } from "../services/demoSeed.js";

const router = Router();

// Zod schemas with strict mode and limits (Zod 4 style: z.email())
const registerSchema = z.strictObject({
  name: z.string().min(2).max(100),
  email: z.email().max(255).toLowerCase(),
  password: z.string().min(8).max(72).regex(/[a-zA-Z]/, "must contain a letter").regex(/[0-9]/, "must contain a number"),
  phone: z.string().max(20).optional(),
  paymentHandle: z.string().max(100).optional(),
  currency: z.enum(["NPR", "INR", "USD"]).optional()
});

const loginSchema = z.strictObject({
  email: z.email().max(255).toLowerCase(),
  password: z.string().min(1).max(72)
});

const updateProfileSchema = z.strictObject({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().max(20).optional(),
  paymentHandle: z.string().max(100).optional(),
  currency: z.enum(["NPR", "INR", "USD"]).optional()
});

// Token helpers
const ACCESS_TTL = "15m";
const REFRESH_TTL = "7d";

function generateAccessToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), email: user.email, isDemo: user.isDemo },
    env.JWT_ACCESS_SECRET,
    { algorithm: "HS256", expiresIn: ACCESS_TTL }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), jti: crypto.randomUUID() },
    env.JWT_REFRESH_SECRET,
    { algorithm: "HS256", expiresIn: REFRESH_TTL }
  );
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function compareHashes(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  return crypto.timingSafeEqual(bufA, bufB);
}

function setRefreshCookie(res, token) {
  const isProd = env.NODE_ENV === "production";
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/api/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
}

function clearRefreshCookie(res) {
  res.clearCookie("refreshToken", { path: "/api/auth" });
}

function safeUserResponse(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    paymentHandle: user.paymentHandle,
    currency: user.currency,
    walletBalanceMinor: user.walletBalanceMinor,
    isDemo: user.isDemo,
    createdAt: user.createdAt
  };
}

// POST /api/auth/register
router.post("/register", authRateLimiter, validate({ body: registerSchema }), async (req, res, next) => {
  try {
    const { name, email, password, phone, paymentHandle, currency } = req.validated.body;

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      passwordHash,
      phone,
      paymentHandle,
      currency
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Store hashed refresh token
    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();

    setRefreshCookie(res, refreshToken);
    res.status(201).json({ accessToken, user: safeUserResponse(user) });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
router.post("/login", authRateLimiter, validate({ body: loginSchema }), async (req, res, next) => {
  try {
    const { email, password } = req.validated.body;

    // Always select passwordHash for comparison
    const user = await User.findOne({ email }).select("+passwordHash");

    // Constant-time comparison even if user not found (prevents timing attacks)
    const dummyHash = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZRGdjGj/n1ZtdOvj.Dv6CjqQd.AjO";
    const passwordHash = user?.passwordHash ?? dummyHash;
    const isValid = await bcrypt.compare(password, passwordHash);

    if (!user || !isValid) {
      throw new AppError(401, "Invalid credentials");
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();

    setRefreshCookie(res, refreshToken);
    res.json({ accessToken, user: safeUserResponse(user) });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/demo
router.post("/demo", demoRateLimiter, async (req, res, next) => {
  try {
    const user = await createEphemeralDemoUser();

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();

    setRefreshCookie(res, refreshToken);
    res.json({ accessToken, user: safeUserResponse(user) });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/refresh
router.post("/refresh", async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      throw new AppError(401, "Refresh token required");
    }

    let payload;
    try {
      payload = jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ["HS256"] });
    } catch {
      throw new AppError(401, "Invalid refresh token");
    }

    const user = await User.findById(payload.userId).select("+refreshTokenHash");
    if (!user || !compareHashes(user.refreshTokenHash, hashToken(token))) {
      clearRefreshCookie(res);
      throw new AppError(401, "Invalid refresh token");
    }

    // Rotate refresh token
    const accessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    user.refreshTokenHash = hashToken(newRefreshToken);
    await user.save();

    setRefreshCookie(res, newRefreshToken);
    res.json({ accessToken });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post("/logout", authenticate, async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user.userId, { refreshTokenHash: null });
    clearRefreshCookie(res);
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      throw new AppError(404, "User not found");
    }
    res.json({ user: safeUserResponse(user) });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/auth/me
router.patch("/me", authenticate, blockDemoUser, validate({ body: updateProfileSchema }), async (req, res, next) => {
  try {
    const updates = req.validated.body;

    // Prevent wallet balance modification via profile update
    delete updates.walletBalanceMinor;
    delete updates.passwordHash;
    delete updates.email;
    delete updates.isDemo;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!user) {
      throw new AppError(404, "User not found");
    }

    res.json({ user: safeUserResponse(user) });
  } catch (error) {
    next(error);
  }
});

export default router;
