import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import "./setup.js";

describe("Groups & Settlements Routes", () => {
  let accessToken;
  let userId;
  let user2Token;
  let user2Id;
  let user3Token;
  let user3Id;

  beforeEach(async () => {
    // Create 3 users
    const res1 = await request(app)
      .post("/api/auth/register")
      .send({
        name: "User One",
        email: "user1@example.com",
        password: "User1Pass123"
      });
    accessToken = res1.body.accessToken;
    userId = res1.body.user.id;

    const res2 = await request(app)
      .post("/api/auth/register")
      .send({
        name: "User Two",
        email: "user2@example.com",
        password: "User2Pass123"
      });
    user2Token = res2.body.accessToken;
    user2Id = res2.body.user.id;

    const res3 = await request(app)
      .post("/api/auth/register")
      .send({
        name: "User Three",
        email: "user3@example.com",
        password: "User3Pass123"
      });
    user3Token = res3.body.accessToken;
    user3Id = res3.body.user.id;
  });

  describe("POST /api/groups", () => {
    it("creates a group with creator as member", async () => {
      const res = await request(app)
        .post("/api/groups")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Test Group", description: "A test group" });

      expect(res.status).toBe(201);
      expect(res.body.group.name).toBe("Test Group");
      expect(res.body.group.members).toContain(userId);
    });

    it("creates group with member emails", async () => {
      const res = await request(app)
        .post("/api/groups")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          name: "Multi-member Group",
          memberEmails: ["user2@example.com", "user3@example.com"]
        });

      expect(res.status).toBe(201);
      expect(res.body.group.members.length).toBe(3);
    });
  });

  describe("POST /api/groups/:groupId/members", () => {
    let groupId;

    beforeEach(async () => {
      const res = await request(app)
        .post("/api/groups")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Add Member Test" });
      groupId = res.body.group._id;
    });

    it("adds member by email", async () => {
      const res = await request(app)
        .post(`/api/groups/${groupId}/members`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "user2@example.com" });

      expect(res.status).toBe(200);
      expect(res.body.group.members.length).toBe(2);
    });

    it("blocks non-member from adding", async () => {
      const res = await request(app)
        .post(`/api/groups/${groupId}/members`)
        .set("Authorization", `Bearer ${user2Token}`)
        .send({ email: "user3@example.com" });

      expect(res.status).toBe(403);
    });
  });

  describe("Group Expenses", () => {
    let groupId;

    beforeEach(async () => {
      const res = await request(app)
        .post("/api/groups")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          name: "Expense Test Group",
          memberEmails: ["user2@example.com", "user3@example.com"]
        });
      groupId = res.body.group._id;
    });

    it("creates EQUAL split expense", async () => {
      const res = await request(app)
        .post(`/api/groups/${groupId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          description: "Dinner",
          amountMinor: 30000,
          payerId: userId,
          splitType: "EQUAL",
          participants: [userId, user2Id, user3Id]
        });

      expect(res.status).toBe(201);
      expect(res.body.expense.splits.length).toBe(3);
      // 30000 / 3 = 10000 each
      expect(res.body.expense.splits.every((s) => s.amountMinor === 10000)).toBe(true);
    });

    it("creates EXACT split expense", async () => {
      const res = await request(app)
        .post(`/api/groups/${groupId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          description: "Custom split dinner",
          amountMinor: 30000,
          payerId: userId,
          splitType: "EXACT",
          participants: [userId, user2Id, user3Id],
          exactSharesMinor: {
            [userId]: 10000,
            [user2Id]: 12000,
            [user3Id]: 8000
          }
        });

      expect(res.status).toBe(201);
    });

    it("creates PERCENT split expense", async () => {
      const res = await request(app)
        .post(`/api/groups/${groupId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          description: "Percentage split",
          amountMinor: 10000,
          payerId: userId,
          splitType: "PERCENT",
          participants: [userId, user2Id, user3Id],
          percentShares: {
            [userId]: 33.33,
            [user2Id]: 33.33,
            [user3Id]: 33.34
          }
        });

      expect(res.status).toBe(201);
      // Sum should be exactly 10000
      const total = res.body.expense.splits.reduce((s, x) => s + x.amountMinor, 0);
      expect(total).toBe(10000);
    });

    it("blocks non-member from creating expense", async () => {
      // Create new user not in group
      const newUser = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Outsider",
          email: "outsider@example.com",
          password: "OutsiderPass123"
        });

      const res = await request(app)
        .post(`/api/groups/${groupId}/expenses`)
        .set("Authorization", `Bearer ${newUser.body.accessToken}`)
        .send({
          description: "Sneaky expense",
          amountMinor: 10000,
          payerId: userId,
          splitType: "EQUAL",
          participants: [userId]
        });

      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /api/groups/:groupId/expenses/:expenseId", () => {
    let groupId;
    let expenseId;

    beforeEach(async () => {
      const groupRes = await request(app)
        .post("/api/groups")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          name: "Delete Test Group",
          memberEmails: ["user2@example.com"]
        });
      groupId = groupRes.body.group._id;

      const expRes = await request(app)
        .post(`/api/groups/${groupId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          description: "To Delete",
          amountMinor: 10000,
          payerId: userId,
          splitType: "EQUAL",
          participants: [userId, user2Id]
        });
      expenseId = expRes.body.expense._id;
    });

    it("allows payer to delete", async () => {
      const res = await request(app)
        .delete(`/api/groups/${groupId}/expenses/${expenseId}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
    });

    it("blocks non-payer non-creator from deleting", async () => {
      const res = await request(app)
        .delete(`/api/groups/${groupId}/expenses/${expenseId}`)
        .set("Authorization", `Bearer ${user2Token}`);

      expect(res.status).toBe(403);
    });

    it("returns 404 for cross-group delete attempt", async () => {
      // Create another group
      const otherGroup = await request(app)
        .post("/api/groups")
        .set("Authorization", `Bearer ${user2Token}`)
        .send({ name: "Other Group" });

      const res = await request(app)
        .delete(`/api/groups/${otherGroup.body.group._id}/expenses/${expenseId}`)
        .set("Authorization", `Bearer ${user2Token}`);

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/groups/:groupId/summary", () => {
    let groupId;

    beforeEach(async () => {
      const groupRes = await request(app)
        .post("/api/groups")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          name: "Summary Test",
          memberEmails: ["user2@example.com", "user3@example.com"]
        });
      groupId = groupRes.body.group._id;

      // User1 pays 30000, split equally
      await request(app)
        .post(`/api/groups/${groupId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          description: "Expense 1",
          amountMinor: 30000,
          payerId: userId,
          splitType: "EQUAL",
          participants: [userId, user2Id, user3Id]
        });
    });

    it("returns simplified debts", async () => {
      const res = await request(app)
        .get(`/api/groups/${groupId}/summary`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.simplifiedTransfers).toBeDefined();
      expect(res.body.netBalances).toBeDefined();

      // User1 paid 30000, owes self 10000, is owed 20000 total (10000 from each other user)
      expect(res.body.netBalances[userId]).toBe(20000);
      expect(res.body.netBalances[user2Id]).toBe(-10000);
      expect(res.body.netBalances[user3Id]).toBe(-10000);
    });
  });

  describe("POST /api/groups/:groupId/settlements", () => {
    let groupId;

    beforeEach(async () => {
      const groupRes = await request(app)
        .post("/api/groups")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          name: "Settlement Test",
          memberEmails: ["user2@example.com"]
        });
      groupId = groupRes.body.group._id;

      // User1 pays, user2 owes
      await request(app)
        .post(`/api/groups/${groupId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          description: "Expense",
          amountMinor: 20000,
          payerId: userId,
          splitType: "EQUAL",
          participants: [userId, user2Id]
        });
    });

    it("creates settlement when user is party to it", async () => {
      const res = await request(app)
        .post(`/api/groups/${groupId}/settlements`)
        .set("Authorization", `Bearer ${user2Token}`)
        .send({
          fromUserId: user2Id,
          toUserId: userId,
          amountMinor: 5000,
          note: "Partial payment"
        });

      expect(res.status).toBe(201);
    });

    it("blocks settlement by non-party", async () => {
      // User3 is not in this group, but even if they were...
      const groupRes = await request(app)
        .post("/api/groups")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          name: "Three Party Settlement Test",
          memberEmails: ["user2@example.com", "user3@example.com"]
        });
      const threeGroupId = groupRes.body.group._id;

      // Create expense: user1 pays
      await request(app)
        .post(`/api/groups/${threeGroupId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          description: "Expense",
          amountMinor: 30000,
          payerId: userId,
          splitType: "EQUAL",
          participants: [userId, user2Id, user3Id]
        });

      // User3 tries to create settlement between user2 and user1
      const res = await request(app)
        .post(`/api/groups/${threeGroupId}/settlements`)
        .set("Authorization", `Bearer ${user3Token}`)
        .send({
          fromUserId: user2Id,
          toUserId: userId,
          amountMinor: 5000
        });

      expect(res.status).toBe(403);
    });

    it("rejects settlement exceeding outstanding debt", async () => {
      // User2 owes 10000 (20000/2)
      const res = await request(app)
        .post(`/api/groups/${groupId}/settlements`)
        .set("Authorization", `Bearer ${user2Token}`)
        .send({
          fromUserId: user2Id,
          toUserId: userId,
          amountMinor: 50000 // More than owed
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("exceeds");
    });

    it("settlement reduces simplified debt", async () => {
      // User2 owes 10000
      await request(app)
        .post(`/api/groups/${groupId}/settlements`)
        .set("Authorization", `Bearer ${user2Token}`)
        .send({
          fromUserId: user2Id,
          toUserId: userId,
          amountMinor: 10000
        });

      const summary = await request(app)
        .get(`/api/groups/${groupId}/summary`)
        .set("Authorization", `Bearer ${accessToken}`);

      // After full settlement, debts should be cleared
      expect(summary.body.simplifiedTransfers.length).toBe(0);
    });
  });

  describe("GET /api/groups/:groupId/export.csv", () => {
    let groupId;

    beforeEach(async () => {
      const groupRes = await request(app)
        .post("/api/groups")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "CSV Export Test" });
      groupId = groupRes.body.group._id;

      await request(app)
        .post(`/api/groups/${groupId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          description: "Test Expense",
          amountMinor: 10000,
          payerId: userId,
          splitType: "EQUAL",
          participants: [userId]
        });
    });

    it("exports CSV with proper headers", async () => {
      const res = await request(app)
        .get(`/api/groups/${groupId}/export.csv`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.headers["content-disposition"]).toContain("attachment");
      expect(res.text).toContain("Date,Description,Amount,Payer");
    });

    it("neutralizes formula injection", async () => {
      await request(app)
        .post(`/api/groups/${groupId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          description: "=SUM(A1:A10)",
          amountMinor: 5000,
          payerId: userId,
          splitType: "EQUAL",
          participants: [userId]
        });

      const res = await request(app)
        .get(`/api/groups/${groupId}/export.csv`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.text).toContain("'=SUM(A1:A10)"); // Prefixed with '
    });
  });
});
