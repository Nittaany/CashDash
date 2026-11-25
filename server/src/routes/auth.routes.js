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
import { sendPasswordResetEmail, sendVerificationEmail } from "../services/mailer.js";

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

const forgotPasswordSchema = z.strictObject({
  email: z.email().max(255).toLowerCase()
});

const resetPasswordSchema = z.strictObject({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(72).regex(/[a-zA-Z]/, "must contain a letter").regex(/[0-9]/, "must contain a number")
});

const verifyEmailSchema = z.strictObject({
  token: z.string().min(1)
});

const resendVerificationSchema = z.strictObject({
  email: z.email().max(255).toLowerCase()
});

// Token helpers
const ACCESS_TTL = "15m";
const REFRESH_TTL = "7d";
const EMAIL_REQUEST_LIMIT = 3;
const EMAIL_REQUEST_WINDOW_MS = 60 * 60 * 1000;

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

async function consumeEmailRequest(userId, countField, windowField) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - EMAIL_REQUEST_WINDOW_MS);
  const windowExpired = {
    $lte: [{ $ifNull: [`$${windowField}`, new Date(0)] }, windowStart]
  };

  const user = await User.findOneAndUpdate(
    {
      _id: userId,
      $or: [
        { [windowField]: { $lte: windowStart } },
        { [windowField]: { $exists: false } },
        { [windowField]: null },
        { [countField]: { $lt: EMAIL_REQUEST_LIMIT } }
      ]
    },
    [{
      $set: {
        [countField]: {
          $cond: [
            windowExpired,
            1,
            { $add: [{ $ifNull: [`$${countField}`, 0] }, 1] }
          ]
        },
        [windowField]: {
          $cond: [windowExpired, now, `$${windowField}`]
        }
      }
    }],
    { new: true }
  );

  return user !== null;
}

function compareHashes(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  return crypto.timingSafeEqual(bufA, bufB);
}

function setRefreshCookie(res, token) {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
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
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt
  };
}

// POST /api/auth/register
router.post("/register", authRateLimiter, validate({ body: registerSchema }), async (req, res, next) => {
  try {
    const { name, email, password, phone, paymentHandle, currency } = req.validated.body;

    const passwordHash = await bcrypt.hash(password, 10);
    
    // Generate email verification token
    const verifyToken = crypto.randomBytes(32).toString("hex");
    const emailVerifyTokenHash = crypto.createHash("sha256").update(verifyToken).digest("hex");
    const emailVerifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await User.create({
      name,
      email,
      passwordHash,
      phone,
      paymentHandle,
      currency,
      isEmailVerified: false,
      emailVerifyTokenHash,
      emailVerifyExpiresAt
    });

    // Send verification email
    await sendVerificationEmail(email, verifyToken);

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Store hashed refresh token
    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();

    setRefreshCookie(res, refreshToken);
    res.status(201).json({ 
      accessToken, 
      user: safeUserResponse(user),
      message: "Registration successful. Please check your email to verify your account."
    });
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

    // Check email verification if required (skip for demo users)
    if (env.REQUIRE_EMAIL_VERIFICATION && !user.isDemo && !user.isEmailVerified) {
      throw new AppError(403, "Please verify your email before logging in");
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

    // Demo users are auto-verified
    user.isEmailVerified = true;
    
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

// POST /api/auth/forgot-password
router.post("/forgot-password", authRateLimiter, validate({ body: forgotPasswordSchema }), async (req, res, next) => {
  try {
    const { email } = req.validated.body;

    // Always return success to prevent email enumeration
    const genericResponse = { message: "If an account exists for that email, a reset link has been sent." };

    const user = await User.findOne({ email });
    
    // Don't generate tokens for non-existent users or demo users
    if (!user || user.isDemo) {
      return res.json(genericResponse);
    }

    const requestAllowed = await consumeEmailRequest(
      user._id,
      "passwordResetRequestCount",
      "passwordResetRequestWindowStartedAt"
    );
    if (!requestAllowed) {
      return res.json(genericResponse);
    }

    // Generate 32-byte random token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
    const resetTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store hashed token and expiry
    user.resetTokenHash = resetTokenHash;
    user.resetTokenExpiresAt = resetTokenExpiresAt;
    await user.save();

    void sendPasswordResetEmail(email, resetToken).catch(() => {
      console.error("[AUTH] Password reset email could not be sent");
    });

    res.json(genericResponse);
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", authRateLimiter, validate({ body: resetPasswordSchema }), async (req, res, next) => {
  try {
    const { token, newPassword } = req.validated.body;

    // Hash the incoming token
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // Find user with matching non-expired token
    const user = await User.findOne({
      resetTokenExpiresAt: { $gt: new Date() }
    }).select("+resetTokenHash +resetTokenExpiresAt +refreshTokenHash");

    if (!user || !user.resetTokenHash) {
      throw new AppError(400, "Invalid or expired reset token");
    }

    // Constant-time comparison
    const storedHash = Buffer.from(user.resetTokenHash, "hex");
    const incomingHash = Buffer.from(tokenHash, "hex");
    
    if (storedHash.length !== incomingHash.length || !crypto.timingSafeEqual(storedHash, incomingHash)) {
      throw new AppError(400, "Invalid or expired reset token");
    }

    // Update password and clear reset token
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetTokenHash = null;
    user.resetTokenExpiresAt = null;
    // Revoke active refresh token to force re-login
    user.refreshTokenHash = null;
    await user.save();

    res.json({ message: "Password reset successfully. Please log in with your new password." });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/verify-email
router.post("/verify-email", authRateLimiter, validate({ body: verifyEmailSchema }), async (req, res, next) => {
  try {
    const { token } = req.validated.body;

    // Hash the incoming token
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // Find user with matching non-expired token
    const user = await User.findOne({
      emailVerifyExpiresAt: { $gt: new Date() }
    }).select("+emailVerifyTokenHash +emailVerifyExpiresAt");

    if (!user || !user.emailVerifyTokenHash) {
      throw new AppError(400, "Invalid or expired verification token");
    }

    // Constant-time comparison
    const storedHash = Buffer.from(user.emailVerifyTokenHash, "hex");
    const incomingHash = Buffer.from(tokenHash, "hex");
    
    if (storedHash.length !== incomingHash.length || !crypto.timingSafeEqual(storedHash, incomingHash)) {
      throw new AppError(400, "Invalid or expired verification token");
    }

    // Mark email as verified and clear token
    user.isEmailVerified = true;
    user.emailVerifyTokenHash = null;
    user.emailVerifyExpiresAt = null;
    await user.save();

    res.json({ message: "Email verified successfully. You can now log in." });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/resend-verification
router.post("/resend-verification", authRateLimiter, validate({ body: resendVerificationSchema }), async (req, res, next) => {
  try {
    const { email } = req.validated.body;

    // Always return success to prevent email enumeration
    const genericResponse = { message: "If an unverified account exists for that email, a new verification link has been sent." };

    const user = await User.findOne({ email, isEmailVerified: false });
    
    // Don't send if user doesn't exist, is already verified, or is a demo user
    if (!user || user.isDemo) {
      return res.json(genericResponse);
    }

    const requestAllowed = await consumeEmailRequest(
      user._id,
      "verificationRequestCount",
      "verificationRequestWindowStartedAt"
    );
    if (!requestAllowed) {
      return res.json(genericResponse);
    }

    // Generate new verification token
    const verifyToken = crypto.randomBytes(32).toString("hex");
    const emailVerifyTokenHash = crypto.createHash("sha256").update(verifyToken).digest("hex");
    const emailVerifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    user.emailVerifyTokenHash = emailVerifyTokenHash;
    user.emailVerifyExpiresAt = emailVerifyExpiresAt;
    await user.save();

    void sendVerificationEmail(email, verifyToken).catch(() => {
      console.error("[AUTH] Verification email could not be sent");
    });

    res.json(genericResponse);
  } catch (error) {
    next(error);
  }
});

export default router;
