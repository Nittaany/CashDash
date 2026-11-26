import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import "./setup.js";
import { app } from "../../src/app.js";
import User from "../../src/models/User.js";
import PendingRegistration from "../../src/models/PendingRegistration.js";
import { mockTransport } from "../../src/services/mailer.js";
import { env } from "../../src/config/env.js";

describe("Email Verification Flow", () => {
  beforeEach(() => {
    mockTransport.clear();
    env.REQUIRE_EMAIL_VERIFICATION = false;
  });

  afterEach(() => {
    env.REQUIRE_EMAIL_VERIFICATION = false;
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe("POST /api/auth/register", () => {
    it("keeps required-verification registrations pending without issuing a session", async () => {
      env.REQUIRE_EMAIL_VERIFICATION = true;

      const response = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Pending User",
          email: "pending-signup@example.com",
          password: "Password123"
        });

      expect(response.status).toBe(202);
      expect(response.body.requiresEmailVerification).toBe(true);
      expect(response.body.user).toBeUndefined();
      expect(response.body.accessToken).toBeUndefined();
      expect(response.headers["set-cookie"]?.some((cookie) =>
        cookie.startsWith("refreshToken=")
      )).not.toBe(true);
      expect(await User.findOne({ email: "pending-signup@example.com" })).toBeNull();
      expect(await PendingRegistration.countDocuments({
        email: "pending-signup@example.com"
      })).toBe(1);
      expect(mockTransport.sentEmails).toHaveLength(1);
      expect(mockTransport.sentEmails[0].subject).toContain("Verify");
    });

    it("returns an identical generic response for eligible, duplicate, pending, and disposable addresses", async () => {
      env.REQUIRE_EMAIL_VERIFICATION = true;
      await User.create({
        name: "Existing User",
        email: "existing-signup@example.com",
        passwordHash: "existing-password-hash",
        isEmailVerified: true
      });

      const eligible = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Eligible User",
          email: "eligible-signup@example.com",
          password: "Password123"
        });
      const pendingDuplicate = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Eligible User",
          email: "eligible-signup@example.com",
          password: "Password123"
        });
      const existing = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Existing User",
          email: "existing-signup@example.com",
          password: "Password123"
        });
      const disposable = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Disposable User",
          email: "person@mailinator.com",
          password: "Password123"
        });

      expect([eligible, pendingDuplicate, existing, disposable].map(({ status }) => status))
        .toEqual([202, 202, 202, 202]);
      expect(pendingDuplicate.body).toEqual(eligible.body);
      expect(existing.body).toEqual(eligible.body);
      expect(disposable.body).toEqual(eligible.body);
      expect(mockTransport.sentEmails).toHaveLength(1);
      expect(await PendingRegistration.countDocuments()).toBe(1);
      expect(await User.countDocuments()).toBe(1);
    });

    it("preserves local session registration when verification is explicitly disabled", async () => {
      env.REQUIRE_EMAIL_VERIFICATION = false;

      const response = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Local User",
          email: "local-signup@example.com",
          password: "Password123"
        });

      expect(response.status).toBe(201);
      expect(response.body.accessToken).toBeDefined();
      expect(response.headers["set-cookie"]?.some((cookie) =>
        cookie.startsWith("refreshToken=")
      )).toBe(true);
      expect(await User.findOne({ email: "local-signup@example.com" })).not.toBeNull();
      expect(await PendingRegistration.countDocuments()).toBe(0);
    });

    it("sends verification email on registration", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          name: "New User",
          email: "newuser@example.com",
          password: "Password123"
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toContain("check your email");
      expect(res.body.user.isEmailVerified).toBe(false);
      
      // Verify email was sent
      expect(mockTransport.sentEmails.length).toBe(1);
      expect(mockTransport.sentEmails[0].subject).toContain("Verify");
    });
  });

  describe("POST /api/auth/demo", () => {
    it("auto-verifies demo users", async () => {
      const res = await request(app).post("/api/auth/demo");

      expect(res.status).toBe(200);
      expect(res.body.user.isEmailVerified).toBe(true);
    });
  });

  describe("POST /api/auth/verify-email", () => {
    let verifyToken;

    beforeEach(async () => {
      mockTransport.clear();
      
      // Register a user to get a verification token
      await request(app)
        .post("/api/auth/register")
        .send({
          name: "Verify User",
          email: "verify@example.com",
          password: "Password123"
        });

      // Extract token from mock email
      const emailHtml = mockTransport.sentEmails[0]?.html;
      const tokenMatch = emailHtml?.match(/token=([a-f0-9]+)/);
      verifyToken = tokenMatch ? tokenMatch[1] : null;
    });

    it("promotes a pending registration only after successful verification", async () => {
      env.REQUIRE_EMAIL_VERIFICATION = true;
      const email = "pending-verification@example.com";
      const registration = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Pending Verification",
          email,
          password: "Password123",
          phone: "555-0101",
          paymentHandle: "pending-handle",
          currency: "USD"
        });
      const tokenMatch = mockTransport.sentEmails.at(-1)?.html.match(/token=([a-f0-9]+)/);
      const token = tokenMatch?.[1];

      expect(registration.status).toBe(202);
      expect(await User.findOne({ email })).toBeNull();
      expect(await PendingRegistration.countDocuments({ email })).toBe(1);

      const verification = await request(app)
        .post("/api/auth/verify-email")
        .send({ token });

      expect(verification.status).toBe(200);
      expect(verification.body.message).toContain("verified successfully");
      expect(await User.countDocuments({ email, isEmailVerified: true })).toBe(1);
      expect(await PendingRegistration.countDocuments({ email })).toBe(0);
      const verifiedUser = await User.findOne({ email });
      expect(verifiedUser.phone).toBe("555-0101");
      expect(verifiedUser.paymentHandle).toBe("pending-handle");
      expect(verifiedUser.currency).toBe("USD");

      const reused = await request(app)
        .post("/api/auth/verify-email")
        .send({ token });
      expect(reused.status).toBe(400);
    });

    it("rejects expired pending-registration tokens", async () => {
      env.REQUIRE_EMAIL_VERIFICATION = true;
      const email = "expired-pending@example.com";
      await request(app)
        .post("/api/auth/register")
        .send({
          name: "Expired Pending",
          email,
          password: "Password123"
        });
      const tokenMatch = mockTransport.sentEmails.at(-1)?.html.match(/token=([a-f0-9]+)/);
      const token = tokenMatch?.[1];
      await PendingRegistration.updateOne(
        { email },
        { $set: { expiresAt: new Date(Date.now() - 1000) } }
      );

      const response = await request(app)
        .post("/api/auth/verify-email")
        .send({ token });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid or expired");
      expect(await User.findOne({ email })).toBeNull();
    });

    it("successfully verifies email with valid token", async () => {
      const res = await request(app)
        .post("/api/auth/verify-email")
        .send({ token: verifyToken });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("verified successfully");

      // Check user is now verified
      const user = await User.findOne({ email: "verify@example.com" });
      expect(user.isEmailVerified).toBe(true);
    });

    it("rejects token reuse (single-use)", async () => {
      // First use
      await request(app)
        .post("/api/auth/verify-email")
        .send({ token: verifyToken });

      // Second use should fail
      const res = await request(app)
        .post("/api/auth/verify-email")
        .send({ token: verifyToken });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid or expired");
    });

    it("rejects invalid token", async () => {
      const res = await request(app)
        .post("/api/auth/verify-email")
        .send({ token: "invalidtoken123" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid or expired");
    });

    it("rejects expired token", async () => {
      // Manually expire the token
      await User.findOneAndUpdate(
        { email: "verify@example.com" },
        { emailVerifyExpiresAt: new Date(Date.now() - 1000) }
      );

      const res = await request(app)
        .post("/api/auth/verify-email")
        .send({ token: verifyToken });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid or expired");
    });
  });

  describe("POST /api/auth/resend-verification", () => {
    beforeEach(async () => {
      mockTransport.clear();
      
      // Register an unverified user
      await request(app)
        .post("/api/auth/register")
        .send({
          name: "Resend User",
          email: "resend@example.com",
          password: "Password123"
        });
      
      mockTransport.clear(); // Clear the registration email
    });

    it("returns generic 200 for existing unverified user", async () => {
      const res = await request(app)
        .post("/api/auth/resend-verification")
        .send({ email: "resend@example.com" });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("If an unverified account exists");
      
      // Verify email was sent
      await vi.waitFor(() => expect(mockTransport.sentEmails).toHaveLength(1));
      expect(mockTransport.sentEmails.length).toBe(1);

      const unknownRes = await request(app)
        .post("/api/auth/resend-verification")
        .send({ email: "nonexistent@example.com" });
      expect(unknownRes.body).toEqual(res.body);
    });

    it("returns generic 200 for non-existent user (anti-enumeration)", async () => {
      const res = await request(app)
        .post("/api/auth/resend-verification")
        .send({ email: "nonexistent@example.com" });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("If an unverified account exists");
      
      // No email sent
      expect(mockTransport.sentEmails.length).toBe(0);
    });

    it("throttles verification requests to three per user per hour", async () => {
      const responses = [];
      for (let i = 0; i < 4; i += 1) {
        responses.push(await request(app)
          .post("/api/auth/resend-verification")
          .send({ email: "resend@example.com" }));
      }

      expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200]);
      expect(responses[3].body).toEqual(responses[0].body);
      await vi.waitFor(() => expect(mockTransport.sentEmails).toHaveLength(3));
      expect(mockTransport.sentEmails).toHaveLength(3);
    });

    it("returns generic 200 for already verified user (no email sent)", async () => {
      // Manually verify the user
      await User.findOneAndUpdate(
        { email: "resend@example.com" },
        { isEmailVerified: true }
      );

      const res = await request(app)
        .post("/api/auth/resend-verification")
        .send({ email: "resend@example.com" });

      expect(res.status).toBe(200);
      
      // No email sent for already verified
      expect(mockTransport.sentEmails.length).toBe(0);
    });

    it("rotates the token for a pending signup and keeps resend responses generic", async () => {
      env.REQUIRE_EMAIL_VERIFICATION = true;
      const email = "pending-resend@example.com";
      await request(app)
        .post("/api/auth/register")
        .send({
          name: "Pending Resend",
          email,
          password: "Password123"
        });
      const oldTokenMatch = mockTransport.sentEmails[0]?.html.match(/token=([a-f0-9]+)/);
      const oldToken = oldTokenMatch?.[1];
      const oldRegistration = await PendingRegistration.findOne({ email })
        .select("+emailVerifyTokenHash");
      mockTransport.clear();

      const resent = await request(app)
        .post("/api/auth/resend-verification")
        .send({ email });
      const newTokenMatch = mockTransport.sentEmails[0]?.html.match(/token=([a-f0-9]+)/);
      const newToken = newTokenMatch?.[1];
      const updatedRegistration = await PendingRegistration.findOne({ email })
        .select("+emailVerifyTokenHash");
      const unknown = await request(app)
        .post("/api/auth/resend-verification")
        .send({ email: "unknown-pending@example.com" });

      expect(resent.status).toBe(200);
      expect(unknown.status).toBe(200);
      expect(unknown.body).toEqual(resent.body);
      expect(newToken).toBeDefined();
      expect(updatedRegistration.emailVerifyTokenHash).not.toBe(oldRegistration.emailVerifyTokenHash);

      const oldTokenVerification = await request(app)
        .post("/api/auth/verify-email")
        .send({ token: oldToken });
      expect(oldTokenVerification.status).toBe(400);

      const newTokenVerification = await request(app)
        .post("/api/auth/verify-email")
        .send({ token: newToken });
      expect(newTokenVerification.status).toBe(200);
    });

    it("keeps the generic resend response when email delivery fails", async () => {
      env.REQUIRE_EMAIL_VERIFICATION = true;
      const email = "delivery-failure@example.com";
      await request(app)
        .post("/api/auth/register")
        .send({
          name: "Delivery Failure",
          email,
          password: "Password123"
        });
      mockTransport.clear();
      vi.spyOn(mockTransport, "send").mockRejectedValueOnce(new Error("provider unavailable"));

      const response = await request(app)
        .post("/api/auth/resend-verification")
        .send({ email });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("If an unverified account exists");
      expect(mockTransport.sentEmails).toHaveLength(0);
    });
  });

  describe("POST /api/auth/login with REQUIRE_EMAIL_VERIFICATION", () => {
    it("does not issue a session before required email verification", async () => {
      env.REQUIRE_EMAIL_VERIFICATION = true;

      const registration = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Pending User",
          email: "pending@example.com",
          password: "Password123"
        });

      expect(registration.status).toBe(202);
      expect(registration.body.requiresEmailVerification).toBe(true);
      expect(registration.body.accessToken).toBeUndefined();
      expect(registration.headers["set-cookie"]?.some((cookie) =>
        cookie.startsWith("refreshToken=")
      )).not.toBe(true);
      expect(mockTransport.sentEmails).toHaveLength(1);

      const login = await request(app)
        .post("/api/auth/login")
        .send({ email: "pending@example.com", password: "Password123" });

      expect(login.status).toBe(401);
      expect(login.body.error).toBe("Invalid credentials");
    });

    it("rejects existing refresh cookies and access tokens for unverified accounts", async () => {
      const registration = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Legacy Pending User",
          email: "legacy-pending@example.com",
          password: "Password123"
        });
      const refreshCookie = registration.headers["set-cookie"]
        .find((cookie) => cookie.startsWith("refreshToken="))
        .split(";")[0];

      env.REQUIRE_EMAIL_VERIFICATION = true;

      const refresh = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", refreshCookie);
      const profile = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${registration.body.accessToken}`);

      expect(refresh.status).toBe(403);
      expect(profile.status).toBe(403);
    });

    it("allows login for verified users", async () => {
      // Register and verify a user
      await request(app)
        .post("/api/auth/register")
        .send({
          name: "Verified User",
          email: "verified@example.com",
          password: "Password123"
        });
      
      await User.findOneAndUpdate(
        { email: "verified@example.com" },
        { isEmailVerified: true }
      );

      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "verified@example.com",
          password: "Password123"
        });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
    });

    // Note: 403 block is only enforced when REQUIRE_EMAIL_VERIFICATION=true
    // which is false by default in tests
  });
});
