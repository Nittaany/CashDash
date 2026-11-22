import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
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
