import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { z } from "zod";
import { env } from "../config/env.js";
import User from "../models/User.js";
import PendingRegistration from "../models/PendingRegistration.js";
import { AppError } from "../middleware/errorHandler.js";
import { validate } from "../middleware/validate.js";
import { authenticate, blockDemoUser } from "../middleware/auth.js";
import {
  authDeviceRateLimiter,
  authEmailRateLimiter,
  authRateLimiter,
  demoRateLimiter,
  ensureAuthDeviceId
} from "../middleware/rateLimit.js";
import { createEphemeralDemoUser } from "../services/demoSeed.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../services/mailer.js";
import { isDisposableEmailAddress } from "../services/disposableEmail.js";
import {
  createOAuthAuthorizationUrl,
  exchangeOAuthCode,
  generateOAuthCodeVerifier,
  generateOAuthState,
  getConfiguredOAuthProviders,
  getOAuthCallbackUrl,
  getOAuthProfile
} from "../services/oauth.js";

const router = Router();

// Zod schemas with strict mode and limits (Zod 4 style: z.email())
const registerSchema = z.strictObject({
  name: z.string().min(2).max(100),
  email: z.email().max(255).trim().toLowerCase(),
  password: z.string().min(8).max(72).regex(/[a-zA-Z]/, "must contain a letter").regex(/[0-9]/, "must contain a number"),
  phone: z.string().max(20).optional(),
  paymentHandle: z.string().max(100).optional(),
  currency: z.enum(["NPR", "INR", "USD"]).optional()
});

const loginSchema = z.strictObject({
  email: z.email().max(255).trim().toLowerCase(),
  password: z.string().min(1).max(72)
});

const updateProfileSchema = z.strictObject({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().max(20).optional(),
  paymentHandle: z.string().max(100).optional(),
  currency: z.enum(["NPR", "INR", "USD"]).optional()
});

const forgotPasswordSchema = z.strictObject({
  email: z.email().max(255).trim().toLowerCase()
});

const resetPasswordSchema = z.strictObject({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(72).regex(/[a-zA-Z]/, "must contain a letter").regex(/[0-9]/, "must contain a number")
});

const verifyEmailSchema = z.strictObject({
  token: z.string().min(1)
});

const resendVerificationSchema = z.strictObject({
  email: z.email().max(255).trim().toLowerCase()
});

// Token helpers
const ACCESS_TTL = "15m";
const REFRESH_TTL = "7d";
const EMAIL_REQUEST_LIMIT = 3;
const EMAIL_REQUEST_WINDOW_MS = 60 * 60 * 1000;
const PENDING_REGISTRATION_TTL_MS = 24 * 60 * 60 * 1000;
const REGISTRATION_RESPONSE = {
  requiresEmailVerification: true,
  message: "If this email is eligible, verification instructions will be sent when available."
};
const OAUTH_FLOW_COOKIE = "oauth_flow";
const OAUTH_FLOW_TTL_MS = 10 * 60 * 1000;

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

async function sendVerificationEmailWithoutLeakingRecipient(email, token) {
  try {
    await sendVerificationEmail(email, token);
  } catch {
    console.error("[AUTH] Verification email could not be sent");
  }
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

function getClientOrigin() {
  return env.APP_URL || env.primaryClientUrl;
}

function signOAuthFlow(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", env.OAUTH_STATE_SECRET)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

function readOAuthFlow(value) {
  if (typeof value !== "string" || !env.OAUTH_STATE_SECRET) return null;
  const [encoded, suppliedSignature] = value.split(".");
  if (!encoded || !suppliedSignature) return null;

  const expectedSignature = crypto.createHmac("sha256", env.OAUTH_STATE_SECRET)
    .update(encoded)
    .digest();
  const receivedSignature = Buffer.from(suppliedSignature, "base64url");
  if (
    expectedSignature.length !== receivedSignature.length ||
    !crypto.timingSafeEqual(expectedSignature, receivedSignature)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (
      typeof payload.state !== "string" ||
      typeof payload.codeVerifier !== "string" ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Date.now() ||
      !["google", "github"].includes(payload.provider) ||
      !["login", "link"].includes(payload.mode) ||
      (payload.mode === "link" && typeof payload.userId !== "string")
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function setOAuthFlowCookie(res, flow) {
  res.cookie(OAUTH_FLOW_COOKIE, signOAuthFlow(flow), {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    path: "/api/auth/oauth",
    maxAge: OAUTH_FLOW_TTL_MS
  });
}

function clearOAuthFlowCookie(res) {
  res.clearCookie(OAUTH_FLOW_COOKIE, {
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    path: "/api/auth/oauth"
  });
}

function redirectOAuthError(res, flow, errorCode) {
  const destination = flow?.mode === "link" ? "/profile" : "/login";
  const url = new URL(destination, getClientOrigin());
  url.searchParams.set("oauthError", errorCode);
  return res.redirect(url.toString());
}

function startOAuthFlow(res, provider, mode, userId) {
  if (!getConfiguredOAuthProviders().includes(provider)) {
    throw new AppError(404, "OAuth provider is not available");
  }

  const state = generateOAuthState();
  const codeVerifier = generateOAuthCodeVerifier();
  const flow = {
    provider,
    mode,
    state,
    codeVerifier,
    ...(userId ? { userId: userId.toString() } : {}),
    expiresAt: Date.now() + OAUTH_FLOW_TTL_MS
  };
  const authorizationUrl = createOAuthAuthorizationUrl(provider, state, codeVerifier);
  setOAuthFlowCookie(res, flow);
  return authorizationUrl;
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
    authProviders: [...new Set((user.providerIdentities || []).map(({ provider }) => provider))],
    createdAt: user.createdAt
  };
}

// POST /api/auth/register
router.post(
  "/register",
  authRateLimiter,
  ensureAuthDeviceId,
  authDeviceRateLimiter,
  validate({ body: registerSchema }),
  authEmailRateLimiter,
  async (req, res, next) => {
    try {
      const { name, email, password, phone, paymentHandle, currency } = req.validated.body;

      if (isDisposableEmailAddress(email)) {
        if (env.REQUIRE_EMAIL_VERIFICATION) {
          return res.status(202).json(REGISTRATION_RESPONSE);
        }
        throw new AppError(400, "Disposable email addresses are not allowed");
      }

      if (env.REQUIRE_EMAIL_VERIFICATION) {
        const now = new Date();
        await PendingRegistration.deleteOne({ email, expiresAt: { $lte: now } });

        if (await User.exists({ email })) {
          return res.status(202).json(REGISTRATION_RESPONSE);
        }
        if (await PendingRegistration.exists({ email, expiresAt: { $gt: now } })) {
          return res.status(202).json(REGISTRATION_RESPONSE);
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const verifyToken = crypto.randomBytes(32).toString("hex");
        const emailVerifyTokenHash = hashToken(verifyToken);
        const expiresAt = new Date(now.getTime() + PENDING_REGISTRATION_TTL_MS);

        try {
          await PendingRegistration.create({
            name,
            email,
            passwordHash,
            emailVerifyTokenHash,
            phone,
            paymentHandle,
            currency,
            expiresAt
          });
        } catch (error) {
          if (error?.code === 11000) {
            return res.status(202).json(REGISTRATION_RESPONSE);
          }
          throw error;
        }

        await sendVerificationEmailWithoutLeakingRecipient(email, verifyToken);
        return res.status(202).json(REGISTRATION_RESPONSE);
      }

      const passwordHash = await bcrypt.hash(password, 10);

      // Generate email verification token
      const verifyToken = crypto.randomBytes(32).toString("hex");
      const emailVerifyTokenHash = crypto.createHash("sha256").update(verifyToken).digest("hex");
      const emailVerifyExpiresAt = new Date(Date.now() + PENDING_REGISTRATION_TTL_MS);

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
  }
);

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

    if (env.REQUIRE_EMAIL_VERIFICATION && !user.isDemo && !user.isEmailVerified) {
      user.refreshTokenHash = null;
      await user.save();
      clearRefreshCookie(res);
      throw new AppError(403, "Please verify your email before logging in");
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
router.post(
  "/forgot-password",
  authRateLimiter,
  validate({ body: forgotPasswordSchema }),
  authEmailRateLimiter,
  async (req, res, next) => {
    try {
      const { email } = req.validated.body;

      // Always return success to prevent email enumeration
      const genericResponse = { message: "If an account exists for that email, we will send a reset link when delivery is available." };

      const user = isDisposableEmailAddress(email)
        ? null
        : await User.findOne({ email }).select("+passwordHash");

      // Only permanent password accounts can use password recovery
      if (!user || user.isDemo || !user.passwordHash) {
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

      try {
        await sendPasswordResetEmail(email, resetToken);
      } catch {
        console.error("[AUTH] Password reset email could not be sent");
      }

      res.json(genericResponse);
    } catch (error) {
      next(error);
    }
  }
);

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
    const tokenHash = hashToken(token);
    const now = new Date();
    const pending = await PendingRegistration.findOne({
      emailVerifyTokenHash: tokenHash,
      expiresAt: { $gt: now }
    }).select("+passwordHash +emailVerifyTokenHash");

    if (pending && compareHashes(pending.emailVerifyTokenHash, tokenHash)) {
      try {
        await User.create({
          name: pending.name,
          email: pending.email,
          passwordHash: pending.passwordHash,
          phone: pending.phone,
          paymentHandle: pending.paymentHandle,
          currency: pending.currency,
          isEmailVerified: true
        });
      } catch (error) {
        if (error?.code === 11000) {
          await PendingRegistration.deleteOne({ _id: pending._id });
          throw new AppError(
            409,
            "An account already exists for this email. Please sign in with your provider."
          );
        }
        throw error;
      }

      await PendingRegistration.deleteOne({ _id: pending._id });
      return res.json({ message: "Email verified successfully. You can now log in." });
    }

    const user = await User.findOne({
      emailVerifyTokenHash: tokenHash,
      emailVerifyExpiresAt: { $gt: now }
    }).select("+emailVerifyTokenHash +emailVerifyExpiresAt");

    if (!user || !user.emailVerifyTokenHash || !compareHashes(user.emailVerifyTokenHash, tokenHash)) {
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
router.post(
  "/resend-verification",
  authRateLimiter,
  ensureAuthDeviceId,
  authDeviceRateLimiter,
  validate({ body: resendVerificationSchema }),
  authEmailRateLimiter,
  async (req, res, next) => {
    try {
      const { email } = req.validated.body;

      // Always return success to prevent email enumeration
      const genericResponse = { message: "If an unverified account exists for that email, we will send a new verification link when delivery is available." };

      const now = new Date();
      const pending = await PendingRegistration.findOne({
        email,
        expiresAt: { $gt: now }
      });

      if (pending) {
        const verifyToken = crypto.randomBytes(32).toString("hex");
        const emailVerifyTokenHash = hashToken(verifyToken);
        const emailVerifyExpiresAt = new Date(now.getTime() + PENDING_REGISTRATION_TTL_MS);
        const updatedPending = await PendingRegistration.findOneAndUpdate(
          { _id: pending._id, expiresAt: { $gt: now } },
          { $set: { emailVerifyTokenHash, expiresAt: emailVerifyExpiresAt } },
          { new: true }
        );

        if (updatedPending) {
          await sendVerificationEmailWithoutLeakingRecipient(email, verifyToken);
          return res.json(genericResponse);
        }
      }

      await PendingRegistration.deleteOne({ email, expiresAt: { $lte: now } });

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
      const emailVerifyExpiresAt = new Date(now.getTime() + PENDING_REGISTRATION_TTL_MS);

      user.emailVerifyTokenHash = emailVerifyTokenHash;
      user.emailVerifyExpiresAt = emailVerifyExpiresAt;
      await user.save();

      await sendVerificationEmailWithoutLeakingRecipient(email, verifyToken);

      res.json(genericResponse);
    } catch (error) {
      next(error);
    }
  }
);

router.get("/providers", (_req, res) => {
  res.json({ providers: getConfiguredOAuthProviders() });
});

router.get("/oauth/:provider", (req, res, next) => {
  try {
    const authorizationUrl = startOAuthFlow(res, req.params.provider, "login");
    res.redirect(authorizationUrl);
  } catch (error) {
    next(error);
  }
});

router.post("/oauth/:provider/link", authenticate, blockDemoUser, (req, res, next) => {
  try {
    const authorizationUrl = startOAuthFlow(
      res,
      req.params.provider,
      "link",
      req.user.userId
    );
    res.json({ authorizationUrl });
  } catch (error) {
    next(error);
  }
});

router.get("/oauth/:provider/callback", async (req, res) => {
  const { provider } = req.params;
  const rawFlow = req.cookies?.[OAUTH_FLOW_COOKIE];
  clearOAuthFlowCookie(res);

  const flow = readOAuthFlow(rawFlow);
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const code = typeof req.query.code === "string" ? req.query.code : "";
  if (!flow || flow.provider !== provider || flow.state !== state) {
    return redirectOAuthError(res, flow, "invalid_state");
  }
  if (typeof req.query.error === "string") {
    return redirectOAuthError(res, flow, "provider_cancelled");
  }
  if (!code || !getConfiguredOAuthProviders().includes(provider)) {
    return redirectOAuthError(res, flow, "provider_failed");
  }

  try {
    const providerAccessToken = await exchangeOAuthCode(provider, code, flow.codeVerifier);
    let profile;
    try {
      profile = await getOAuthProfile(provider, providerAccessToken);
    } catch (error) {
      if (error.message === "OAuth provider email is missing or unverified") {
        return redirectOAuthError(res, flow, "provider_email_unverified");
      }
      throw error;
    }

    profile = { ...profile, email: profile.email.trim().toLowerCase() };
    if (isDisposableEmailAddress(profile.email)) {
      return redirectOAuthError(res, flow, "disposable_email");
    }

    if (flow.mode === "link") {
      const identityOwner = await User.findOne({
        providerIdentities: {
          $elemMatch: {
            provider,
            providerUserId: profile.providerUserId
          }
        }
      });
      if (identityOwner && identityOwner._id.toString() !== flow.userId) {
        return redirectOAuthError(res, flow, "identity_already_linked");
      }

      const user = await User.findById(flow.userId);
      if (!user) {
        return redirectOAuthError(res, flow, "link_session_expired");
      }
      const alreadyLinked = user.providerIdentities.some((identity) =>
        identity.provider === provider && identity.providerUserId === profile.providerUserId
      );
      if (!alreadyLinked) {
        user.providerIdentities.push({
          provider,
          providerUserId: profile.providerUserId
        });
        try {
          await user.save();
        } catch (error) {
          if (error.code === 11000) {
            return redirectOAuthError(res, flow, "identity_already_linked");
          }
          throw error;
        }
      }

      const url = new URL("/profile", getClientOrigin());
      url.searchParams.set("oauthLinked", provider);
      return res.redirect(url.toString());
    }

    let user = await User.findOne({
      providerIdentities: {
        $elemMatch: {
          provider,
          providerUserId: profile.providerUserId
        }
      }
    }).select("+refreshTokenHash");
    if (!user) {
      const emailOwner = await User.findOne({ email: profile.email });
      if (emailOwner) {
        if (emailOwner.providerIdentities?.length) {
          await PendingRegistration.deleteOne({ email: profile.email });
        }
        return redirectOAuthError(res, flow, "account_exists_sign_in");
      }

      try {
        user = await User.create({
          name: profile.name,
          email: profile.email,
          isEmailVerified: true,
          providerIdentities: [{
            provider,
            providerUserId: profile.providerUserId
          }]
        });
      } catch (error) {
        if (error.code === 11000) {
          user = await User.findOne({
            providerIdentities: {
              $elemMatch: {
                provider,
                providerUserId: profile.providerUserId
              }
            }
          }).select("+refreshTokenHash");
          if (!user) {
            const emailOwner = await User.findOne({ email: profile.email });
            if (emailOwner?.providerIdentities?.length) {
              await PendingRegistration.deleteOne({ email: profile.email });
            }
            return redirectOAuthError(res, flow, "account_exists_sign_in");
          }
        } else {
          throw error;
        }
      }
    }

    await PendingRegistration.deleteOne({ email: profile.email });

    if (env.REQUIRE_EMAIL_VERIFICATION && !user.isEmailVerified) {
      return redirectOAuthError(res, flow, "provider_email_unverified");
    }

    const refreshToken = generateRefreshToken(user);
    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();
    setRefreshCookie(res, refreshToken);
    return res.redirect(new URL("/oauth/callback", getClientOrigin()).toString());
  } catch (error) {
    console.error("[AUTH] OAuth callback failed");
    return redirectOAuthError(res, flow, "provider_failed");
  }
});

export default router;
