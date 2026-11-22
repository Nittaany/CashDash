import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/app.js";

describe("GET /api/health", () => {
  it("returns application and database status", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.db).toBe("disconnected");
    expect(Number.isInteger(response.body.uptimeSeconds)).toBe(true);
  });
});
