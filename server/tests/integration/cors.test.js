import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";

describe("CORS allowlist", () => {
  let app;
  let allowedOrigins;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("CLIENT_URL", "http://localhost:3000, https://cashdash.example.com");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PORT", "5002");
    vi.stubEnv("MONGODB_URI", "mongodb://localhost:27017/cashdash-cors-test");
    vi.stubEnv("JWT_ACCESS_SECRET", "test-access-secret-at-least-32-characters-long");
    vi.stubEnv("JWT_REFRESH_SECRET", "test-refresh-secret-at-least-32-characters-long");
    vi.stubEnv("TRUST_PROXY", "1");
    vi.stubEnv("COOKIE_SECURE", "false");
    vi.stubEnv("COOKIE_SAMESITE", "lax");

    const appModule = await import("../../src/app.js");
    app = appModule.app;
    allowedOrigins = appModule.allowedOrigins;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("parses comma-separated origins with whitespace trimmed", () => {
    expect(allowedOrigins).toContain("http://localhost:3000");
    expect(allowedOrigins).toContain("https://cashdash.example.com");
    expect(allowedOrigins.length).toBe(2);
  });

  it("returns matching Access-Control-Allow-Origin for first allowed origin", async () => {
    const res = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:3000");

    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("returns matching Access-Control-Allow-Origin for second allowed origin", async () => {
    const res = await request(app)
      .get("/api/health")
      .set("Origin", "https://cashdash.example.com");

    expect(res.headers["access-control-allow-origin"]).toBe("https://cashdash.example.com");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("does not return Access-Control-Allow-Origin for unlisted origin", async () => {
    const res = await request(app)
      .get("/api/health")
      .set("Origin", "https://evil.com");

    // CORS middleware throws error, which results in no CORS headers
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("never returns wildcard * for Access-Control-Allow-Origin", async () => {
    const res1 = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:3000");

    const res2 = await request(app)
      .get("/api/health");

    expect(res1.headers["access-control-allow-origin"]).not.toBe("*");
    expect(res2.headers["access-control-allow-origin"]).not.toBe("*");
  });

  it("preflight OPTIONS /api/auth/login returns status < 300", async () => {
    const res = await request(app)
      .options("/api/auth/login")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "Content-Type");

    expect(res.status).toBeLessThan(300);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });
});
