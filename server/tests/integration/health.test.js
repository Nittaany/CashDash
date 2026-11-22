import { describe, it, expect } from "vitest";
import request from "supertest";
import { app, allowedOrigins } from "../../src/app.js";
import "./setup.js";

describe("GET /api/health", () => {
  it("returns health status with db connected", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.db).toBe("connected");
    expect(typeof response.body.uptimeSeconds).toBe("number");
  });
});

describe("CORS", () => {
  it("accepts multiple comma-separated origins from CLIENT_URL", () => {
    // vitest.config.js sets CLIENT_URL=http://localhost:3000,http://localhost:5173
    expect(allowedOrigins).toContain("http://localhost:3000");
    expect(allowedOrigins).toContain("http://localhost:5173");
  });

  it("allows request from first allowed origin", async () => {
    const res = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:3000");

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });

  it("allows request from second allowed origin", async () => {
    const res = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:5173");

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("allows request with no origin (curl, mobile)", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
  });
});
