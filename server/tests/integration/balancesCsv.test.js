import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import "./setup.js";
import { app } from "../../src/app.js";

describe("Balances CSV Export", () => {
  let accessToken;
  let groupId;
  let userId;

  beforeEach(async () => {
    // Create user
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "CSV User",
        email: "csv@example.com",
        password: "Password123"
      });
    accessToken = res.body.accessToken;
    userId = res.body.user.id;

    // Create group
    const groupRes = await request(app)
      .post("/api/groups")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "CSV Test Group", currency: "NPR" });
    groupId = groupRes.body.group._id;
  });

  describe("GET /api/groups/:groupId/balances.csv", () => {
    it("returns CSV with net balances header", async () => {
      const res = await request(app)
        .get(`/api/groups/${groupId}/balances.csv`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.headers["content-disposition"]).toContain("balances.csv");
      expect(res.text).toContain("Net Balances");
      expect(res.text).toContain("Member");
      expect(res.text).toContain("Balance (NPR)");
    });

    it("includes simplified transfers section", async () => {
      const res = await request(app)
        .get(`/api/groups/${groupId}/balances.csv`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.text).toContain("Simplified Transfers");
      expect(res.text).toContain("From");
      expect(res.text).toContain("To");
      expect(res.text).toContain("Amount (NPR)");
    });

    it("shows correct balances after expenses", async () => {
      // Create another member
      const member2Res = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Member Two",
          email: "member2@example.com",
          password: "Password123"
        });
      const member2Id = member2Res.body.user.id;

      await request(app)
        .post(`/api/groups/${groupId}/members`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "member2@example.com" });

      // Add expense: user paid 1000, split equally
      await request(app)
        .post(`/api/groups/${groupId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          description: "Test expense",
          amountMinor: 100000, // 1000.00
          payerId: userId,
          splitType: "EQUAL",
          participants: [userId, member2Id]
        });

      const res = await request(app)
        .get(`/api/groups/${groupId}/balances.csv`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      // User should be owed 500, member2 owes 500
      expect(res.text).toContain("500.00");
      expect(res.text).toContain("-500.00");
    });

    it("requires authentication", async () => {
      const res = await request(app)
        .get(`/api/groups/${groupId}/balances.csv`);

      expect(res.status).toBe(401);
    });

    it("requires group membership", async () => {
      // Create another user not in group
      const otherRes = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Other User",
          email: "other@example.com",
          password: "Password123"
        });

      const res = await request(app)
        .get(`/api/groups/${groupId}/balances.csv`)
        .set("Authorization", `Bearer ${otherRes.body.accessToken}`);

      expect(res.status).toBe(403);
    });
  });
});
