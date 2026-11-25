import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import "./setup.js";
import { app } from "../../src/app.js";
import User from "../../src/models/User.js";
import { mockTransport } from "../../src/services/mailer.js";

describe("Email Verification Flow", () => {
  beforeEach(() => {
    mockTransport.clear();
  });

  describe("POST /api/auth/register", () => {
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
  });

  describe("POST /api/auth/login with REQUIRE_EMAIL_VERIFICATION", () => {
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
