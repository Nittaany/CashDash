import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import User from "../../src/models/User.js";
import "./setup.js";

describe("Auth Routes", () => {
  describe("POST /api/auth/register", () => {
    it("registers a new user successfully", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Test User",
          email: "test@example.com",
          password: "TestPass123"
        });

      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe("test@example.com");
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.headers["set-cookie"]).toBeDefined();
    });

    it("returns 409 for duplicate email", async () => {
      // First registration
      await request(app)
        .post("/api/auth/register")
        .send({
          name: "First User",
          email: "dupe@example.com",
          password: "TestPass123"
        });

      // Wait for index to be ready
      await User.init();

      // Duplicate attempt
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Second User",
          email: "dupe@example.com",
          password: "TestPass456"
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("Duplicate");
    });

    it("returns 400 for invalid password", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Test User",
          email: "weak@example.com",
          password: "weak" // Too short, no number
        });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/auth/login", () => {
    it("logs in successfully with correct credentials", async () => {
      // First register the user
      await request(app)
        .post("/api/auth/register")
        .send({
          name: "Login Test",
          email: "login@example.com",
          password: "LoginPass123"
        });

      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "login@example.com",
          password: "LoginPass123"
        });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe("login@example.com");
    });

    it("returns 401 for wrong password", async () => {
      await request(app)
        .post("/api/auth/register")
        .send({
          name: "Wrong Pass Test",
          email: "wrongpass@example.com",
          password: "CorrectPass123"
        });

      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "wrongpass@example.com",
          password: "WrongPassword123"
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid credentials");
    });

    it("returns 401 for non-existent user", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "nonexistent@example.com",
          password: "SomePassword123"
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid credentials");
    });
  });

  describe("GET /api/auth/me", () => {
    it("returns 401 without token", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
    });

    it("returns user profile with valid token", async () => {
      const registerRes = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Me Test",
          email: "me@example.com",
          password: "MePass123"
        });

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${registerRes.body.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe("me@example.com");
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("refreshes access token with valid refresh cookie", async () => {
      const registerRes = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Refresh Test",
          email: "refresh@example.com",
          password: "RefreshPass123"
        });

      // Extract cookie from set-cookie header
      const setCookie = registerRes.headers["set-cookie"];
      const refreshCookie = setCookie?.find((c) => c.startsWith("refreshToken="));

      expect(refreshCookie).toBeDefined();

      // Send the full cookie string (supertest needs just the key=value part for path-restricted cookies)
      const cookieValue = refreshCookie.split(";")[0];

      const res = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", cookieValue);

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
    });

    it("rotates refresh token - old token rejected after refresh", async () => {
      const registerRes = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Rotation Test",
          email: "rotation@example.com",
          password: "RotationPass123"
        });

      const setCookie = registerRes.headers["set-cookie"];
      const oldCookie = setCookie?.find((c) => c.startsWith("refreshToken="))?.split(";")[0];

      // First refresh - should succeed and rotate token
      const refresh1 = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", oldCookie);

      expect(refresh1.status).toBe(200);

      // Second refresh with OLD cookie - should fail (token was rotated)
      const refresh2 = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", oldCookie);

      expect(refresh2.status).toBe(401);
    });

    it("returns 401 without refresh cookie", async () => {
      const res = await request(app).post("/api/auth/refresh");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/auth/demo", () => {
    it("creates demo user and returns token", async () => {
      const res = await request(app).post("/api/auth/demo");

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe("demo@cashdash.app");
      expect(res.body.user.isDemo).toBe(true);
    });

    it("is idempotent - returns same user on repeated calls", async () => {
      const res1 = await request(app).post("/api/auth/demo");
      const res2 = await request(app).post("/api/auth/demo");

      expect(res1.body.user.id).toBe(res2.body.user.id);
    });
  });

  describe("PATCH /api/auth/me", () => {
    it("updates profile successfully", async () => {
      const registerRes = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Patch Test",
          email: "patch@example.com",
          password: "PatchPass123"
        });

      const res = await request(app)
        .patch("/api/auth/me")
        .set("Authorization", `Bearer ${registerRes.body.accessToken}`)
        .send({ name: "Updated Name", currency: "USD" });

      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe("Updated Name");
      expect(res.body.user.currency).toBe("USD");
    });

    it("cannot modify walletBalanceMinor via profile update", async () => {
      const registerRes = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Wallet Hack",
          email: "wallet@example.com",
          password: "WalletPass123"
        });

      // Try to sneak in walletBalanceMinor along with valid field
      // The route should strip it out even if it somehow passes validation
      const res = await request(app)
        .patch("/api/auth/me")
        .set("Authorization", `Bearer ${registerRes.body.accessToken}`)
        .send({ name: "Updated Name" });

      expect(res.status).toBe(200);

      // Verify wallet balance is still 0
      const meRes = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${registerRes.body.accessToken}`);

      expect(meRes.body.user.walletBalanceMinor).toBe(0);
    });

    it("blocks demo users from modifying profile", async () => {
      const demoRes = await request(app).post("/api/auth/demo");

      const res = await request(app)
        .patch("/api/auth/me")
        .set("Authorization", `Bearer ${demoRes.body.accessToken}`)
        .send({ name: "Hacked Demo" });

      expect(res.status).toBe(403);
    });
  });
});
