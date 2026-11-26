import { describe, it, expect } from "vitest";
import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import rateLimit from "express-rate-limit";
import {
  authDeviceRateLimitKey,
  authEmailRateLimitKey,
  createAuthRateLimiter,
  ensureAuthDeviceId
} from "../../src/middleware/rateLimit.js";
import { env } from "../../src/config/env.js";

function cookieValue(response) {
  return response.headers["set-cookie"]
    .find((cookie) => cookie.startsWith("cashdash_device="))
    .split(";")[0]
    .slice("cashdash_device=".length);
}

describe("Rate Limiter", () => {
  it("returns 429 after exceeding max requests", async () => {
    // Create a fresh app with a strict rate limiter (max: 3)
    const app = express();
    const strictLimiter = rateLimit({
      windowMs: 60 * 1000,
      limit: 3,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: "Too many requests" }
    });

    app.use(strictLimiter);
    app.get("/test", (req, res) => res.json({ ok: true }));

    // First 3 requests should succeed
    for (let i = 0; i < 3; i++) {
      const res = await request(app).get("/test");
      expect(res.status).toBe(200);
    }

    // 4th request should be rate limited
    const res = await request(app).get("/test");
    expect(res.status).toBe(429);
    expect(res.body.error).toBe("Too many requests");
  });

  it("includes rate limit headers in response", async () => {
    const app = express();
    const limiter = rateLimit({
      windowMs: 60 * 1000,
      limit: 5,
      standardHeaders: true,
      legacyHeaders: true
    });

    app.use(limiter);
    app.get("/test", (req, res) => res.json({ ok: true }));

    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
    // Check for standard or legacy headers
    const hasRateLimitHeaders = 
      res.headers["x-ratelimit-limit"] === "5" ||
      res.headers["ratelimit-limit"] === "5";
    expect(hasRateLimitHeaders).toBe(true);
  });

  it("sets a random, scoped device cookie with the required attributes", async () => {
    const app = express();
    app.use(cookieParser());
    app.get("/device", ensureAuthDeviceId, (req, res) => {
      res.json({ deviceId: req.authDeviceId });
    });

    const first = await request(app).get("/device");
    const second = await request(app).get("/device");

    expect(first.body.deviceId).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second.body.deviceId).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second.body.deviceId).not.toBe(first.body.deviceId);

    const cookie = first.headers["set-cookie"].find((value) =>
      value.startsWith("cashdash_device=")
    );
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/api/auth");
    expect(cookie).toContain("Max-Age=2592000");
    expect(cookie).not.toContain("Secure");
  });

  it("marks the device cookie Secure in production", async () => {
    const originalNodeEnv = env.NODE_ENV;
    env.NODE_ENV = "production";

    try {
      const app = express();
      app.use(cookieParser());
      app.get("/device", ensureAuthDeviceId, (req, res) => {
        res.json({ deviceId: req.authDeviceId });
      });

      const response = await request(app).get("/device");
      const cookie = response.headers["set-cookie"].find((value) =>
        value.startsWith("cashdash_device=")
      );

      expect(cookie).toContain("Secure");
    } finally {
      env.NODE_ENV = originalNodeEnv;
    }
  });

  it("uses normalized, domain-separated HMAC keys for email and device values", () => {
    const normalizedEmailKey = authEmailRateLimitKey(" Person@EXAMPLE.com ");

    expect(normalizedEmailKey).toBe(authEmailRateLimitKey("person@example.com"));
    expect(normalizedEmailKey).not.toContain("person@example.com");
    expect(authDeviceRateLimitKey("person@example.com")).not.toBe(normalizedEmailKey);
    expect(authDeviceRateLimitKey("secret-device-id")).not.toContain("secret-device-id");
  });

  it("limits an email to three requests per hour", async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.validated = { body: req.body };
      next();
    });
    app.use(createAuthRateLimiter({
      windowMs: 60 * 60 * 1000,
      limit: 3,
      message: { error: "Email limit" },
      keyGenerator: (req) => authEmailRateLimitKey(req.validated.body.email),
      skipInTest: false
    }));
    app.post("/email", (_req, res) => res.json({ ok: true }));

    const responses = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      responses.push(await request(app)
        .post("/email")
        .send({ email: "  email-limit@example.com  " }));
    }

    expect(responses.map(({ status }) => status)).toEqual([200, 200, 200, 429]);
    expect(responses[3].body.error).toBe("Email limit");
  });

  it("keeps IP, normalized-email, and device request buckets independent", async () => {
    const app = express();

    app.set("trust proxy", false);
    app.use(express.json());
    app.use(cookieParser());
    app.use(createAuthRateLimiter({
      windowMs: 60_000,
      limit: 3,
      message: { error: "IP limit" },
      skipInTest: false
    }));
    app.use(ensureAuthDeviceId);
    app.use((req, _res, next) => {
      req.validated = { body: req.body };
      next();
    });
    app.use(createAuthRateLimiter({
      windowMs: 60_000,
      limit: 1,
      message: { error: "Email limit" },
      keyGenerator: (req) => authEmailRateLimitKey(req.validated.body.email),
      skipInTest: false
    }));
    app.use(createAuthRateLimiter({
      windowMs: 60_000,
      limit: 1,
      message: { error: "Device limit" },
      keyGenerator: (req) => authDeviceRateLimitKey(req.authDeviceId),
      skipInTest: false
    }));
    app.post("/signup", (_req, res) => res.json({ ok: true }));

    const first = await request(app).post("/signup").send({ email: "Alice@Example.com" });
    const deviceCookie = `cashdash_device=${cookieValue(first)}`;
    const sameEmail = await request(app)
      .post("/signup")
      .set("Cookie", deviceCookie)
      .send({ email: "alice@example.com" });
    const sameDevice = await request(app)
      .post("/signup")
      .set("Cookie", deviceCookie)
      .send({ email: "bob@example.com" });
    const sameIp = await request(app).post("/signup").send({ email: "charlie@example.com" });

    expect(first.status).toBe(200);
    expect(sameEmail.status).toBe(429);
    expect(sameEmail.body.error).toBe("Email limit");
    expect(sameDevice.status).toBe(429);
    expect(sameDevice.body.error).toBe("Device limit");
    expect(sameIp.status).toBe(429);
    expect(sameIp.body.error).toBe("IP limit");
  });
});
