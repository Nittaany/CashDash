import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import rateLimit from "express-rate-limit";

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
});
