import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import crypto from "crypto";
import "./setup.js";
import { app } from "../../src/app.js";
import User from "../../src/models/User.js";
import { mockTransport } from "../../src/services/mailer.js";
import * as mailer from "../../src/services/mailer.js";

describe("Password Reset Flow", () => {
  beforeEach(() => {
    mockTransport.clear();
  });

  describe("POST /api/auth/forgot-password", () => {
    it("returns generic 200 for existing user", async () => {
      // Create a user
      await request(app)
        .post("/api/auth/register")
        .send({
          name: "Test User",
          email: "test@example.com",
          password: "Password123"
        });

      mockTransport.clear(); // Clear the registration verification email

      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "test@example.com" });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("If an account exists");

      const unknownRes = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "nonexistent@example.com" });
      expect(unknownRes.body).toEqual(res.body);
      
      // Verify password reset email was "sent"
      await vi.waitFor(() => expect(mockTransport.sentEmails).toHaveLength(1));
      expect(mockTransport.sentEmails.length).toBe(1);
      expect(mockTransport.sentEmails[0].to).toBe("test@example.com");
      expect(mockTransport.sentEmails[0].subject).toContain("Password Reset");
    });

    it("returns generic 200 for non-existent user (anti-enumeration)", async () => {
      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "nonexistent@example.com" });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("If an account exists");
      
      // No email sent
      expect(mockTransport.sentEmails.length).toBe(0);
    });

    it("keeps delivery failures account-neutral and does not claim an email was sent", async () => {
      await request(app)
        .post("/api/auth/register")
        .send({
          name: "Delivery Failure User",
          email: "delivery-failure@example.com",
          password: "Password123"
        });

      const sendFailure = vi.spyOn(mailer, "sendPasswordResetEmail")
        .mockRejectedValue(new Error("Email send failed"));
      const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

      const existing = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "delivery-failure@example.com" });
      const unknown = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "unknown-delivery-failure@example.com" });

      expect(existing.status).toBe(200);
      expect(existing.body).toEqual(unknown.body);
      expect(existing.body.message).not.toMatch(/has been sent/i);
      expect(sendFailure).toHaveBeenCalledOnce();
      expect(errorLog).toHaveBeenCalledWith("[AUTH] Password reset email could not be sent");

      sendFailure.mockRestore();
      errorLog.mockRestore();
    });

    it("throttles password reset requests to three per user per hour", async () => {
      await request(app)
        .post("/api/auth/register")
        .send({
          name: "Test User",
          email: "throttle@example.com",
          password: "Password123"
        });
      mockTransport.clear();

      const responses = [];
      for (let i = 0; i < 4; i += 1) {
        responses.push(await request(app)
          .post("/api/auth/forgot-password")
          .send({ email: "throttle@example.com" }));
      }

      expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200]);
      expect(responses[3].body).toEqual(responses[0].body);
      await vi.waitFor(() => expect(mockTransport.sentEmails).toHaveLength(3));
      expect(mockTransport.sentEmails).toHaveLength(3);
    });

    it("returns generic 200 for demo user (no token generated)", async () => {
      // Create demo user
      const demoRes = await request(app).post("/api/auth/demo");
      const demoEmail = demoRes.body.user.email;

      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: demoEmail });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("If an account exists");
      
      // No email sent for demo users
      expect(mockTransport.sentEmails.length).toBe(0);
    });

    it("validates email format", async () => {
      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "invalid-email" });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/auth/reset-password", () => {
    async function createUserAndGetResetToken() {
      mockTransport.clear();
      
      // Create a user
      await request(app)
        .post("/api/auth/register")
        .send({
          name: "Test User",
          email: "reset@example.com",
          password: "OldPassword123"
        });

      mockTransport.clear(); // Clear the verification email

      // Trigger forgot password to get a token
      await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "reset@example.com" });

      // Extract token from password reset email (the only email now)
      await vi.waitFor(() => expect(mockTransport.sentEmails).toHaveLength(1));
      const resetEmail = mockTransport.sentEmails.find(e => e.subject.includes("Password Reset"));
      const emailHtml = resetEmail?.html;
      const tokenMatch = emailHtml?.match(/token=([a-f0-9]+)/);
      return tokenMatch ? tokenMatch[1] : null;
    }

    it("successfully resets password with valid token", async () => {
      const validToken = await createUserAndGetResetToken();
      
      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({
          token: validToken,
          newPassword: "NewPassword456"
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("Password reset successfully");

      // Verify can login with new password
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({
          email: "reset@example.com",
          password: "NewPassword456"
        });

      expect(loginRes.status).toBe(200);
    });

    it("rejects token reuse (single-use)", async () => {
      const validToken = await createUserAndGetResetToken();
      
      // First use
      await request(app)
        .post("/api/auth/reset-password")
        .send({
          token: validToken,
          newPassword: "NewPassword456"
        });

      // Second use should fail
      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({
          token: validToken,
          newPassword: "AnotherPassword789"
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid or expired");
    });

    it("rejects invalid token", async () => {
      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({
          token: "invalidtoken123",
          newPassword: "NewPassword456"
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid or expired");
    });

    it("rejects expired token", async () => {
      const validToken = await createUserAndGetResetToken();
      
      // Manually expire the token
      await User.findOneAndUpdate(
        { email: "reset@example.com" },
        { resetTokenExpiresAt: new Date(Date.now() - 1000) }
      );

      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({
          token: validToken,
          newPassword: "NewPassword456"
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid or expired");
    });

    it("invalidates existing refresh token after reset", async () => {
      const validToken = await createUserAndGetResetToken();
      
      // Login to get a refresh token
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({
          email: "reset@example.com",
          password: "OldPassword123"
        });

      const cookies = loginRes.headers["set-cookie"];

      // Reset password
      await request(app)
        .post("/api/auth/reset-password")
        .send({
          token: validToken,
          newPassword: "NewPassword456"
        });

      // Try to refresh with old cookie - should fail
      const refreshRes = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", cookies);

      expect(refreshRes.status).toBe(401);
    });

    it("validates new password requirements", async () => {
      const validToken = await createUserAndGetResetToken();
      
      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({
          token: validToken,
          newPassword: "weak"
        });

      expect(res.status).toBe(400);
    });
  });
});

describe("X-Request-Id Header", () => {
  it("returns X-Request-Id on /api/health", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.headers["x-request-id"]).toBeDefined();
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("echoes provided X-Request-Id", async () => {
    const customId = "custom-request-id-12345";
    const res = await request(app)
      .get("/api/health")
      .set("X-Request-Id", customId);

    expect(res.status).toBe(200);
    expect(res.headers["x-request-id"]).toBe(customId);
  });
});
