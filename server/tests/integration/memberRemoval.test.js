import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import "./setup.js";
import { app } from "../../src/app.js";

describe("Group Member Removal", () => {
  let accessToken;
  let groupId;
  let memberAccessToken;
  let memberId;

  beforeEach(async () => {
    // Create group creator
    const creatorRes = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Group Creator",
        email: "creator@example.com",
        password: "Password123"
      });
    accessToken = creatorRes.body.accessToken;

    // Create a member
    const memberRes = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Group Member",
        email: "member@example.com",
        password: "Password123"
      });
    memberAccessToken = memberRes.body.accessToken;
    memberId = memberRes.body.user.id;

    // Create group with member
    const groupRes = await request(app)
      .post("/api/groups")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Test Group",
        memberEmails: ["member@example.com"]
      });
    groupId = groupRes.body.group._id;
  });

  describe("DELETE /api/groups/:groupId/members/:memberId", () => {
    it("successfully removes member with zero balance", async () => {
      const res = await request(app)
        .delete(`/api/groups/${groupId}/members/${memberId}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("removed successfully");
      expect(res.body.group.members.some(m => m._id === memberId)).toBe(false);
    });

    it("returns 409 when member has non-zero balance", async () => {
      // Add an expense where member owes money
      const creatorId = (await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${accessToken}`)).body.user.id;

      await request(app)
        .post(`/api/groups/${groupId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          description: "Test expense",
          amountMinor: 10000,
          payerId: creatorId,
          splitType: "EQUAL",
          participants: [creatorId, memberId]
        });

      const res = await request(app)
        .delete(`/api/groups/${groupId}/members/${memberId}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("Cannot remove member");
      expect(res.body.error).toContain("owes");
    });

    it("allows member to leave group (remove self)", async () => {
      const res = await request(app)
        .delete(`/api/groups/${groupId}/members/${memberId}`)
        .set("Authorization", `Bearer ${memberAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("removed successfully");
    });

    it("returns 403 when non-creator tries to remove others", async () => {
      // Create another member
      const anotherRes = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Another Member",
          email: "another@example.com",
          password: "Password123"
        });
      const anotherId = anotherRes.body.user.id;

      await request(app)
        .post(`/api/groups/${groupId}/members`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ email: "another@example.com" });

      // Member trying to remove another member
      const res = await request(app)
        .delete(`/api/groups/${groupId}/members/${anotherId}`)
        .set("Authorization", `Bearer ${memberAccessToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("Only the group creator");
    });
  });
});

describe("Group Expense Pagination", () => {
  let accessToken;
  let groupId;
  let userId;

  beforeEach(async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Pagination User",
        email: "pagination@example.com",
        password: "Password123"
      });
    accessToken = res.body.accessToken;
    userId = res.body.user.id;

    const groupRes = await request(app)
      .post("/api/groups")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Pagination Group" });
    groupId = groupRes.body.group._id;

    // Add multiple expenses
    for (let i = 1; i <= 25; i++) {
      await request(app)
        .post(`/api/groups/${groupId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          description: `Expense ${i}`,
          amountMinor: 1000,
          payerId: userId,
          splitType: "EQUAL",
          participants: [userId]
        });
    }
  });

  it("returns paginated expenses with default limit", async () => {
    const res = await request(app)
      .get(`/api/groups/${groupId}/summary`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.expenses.length).toBe(20); // default limit
    expect(res.body.pagination.totalExpenses).toBe(25);
    expect(res.body.pagination.totalPages).toBe(2);
  });

  it("returns specified page and limit", async () => {
    const res = await request(app)
      .get(`/api/groups/${groupId}/summary?page=2&limit=10`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.expenses.length).toBe(10);
    expect(res.body.pagination.page).toBe(2);
    expect(res.body.pagination.limit).toBe(10);
  });

  it("caps limit at 100", async () => {
    const res = await request(app)
      .get(`/api/groups/${groupId}/summary?limit=200`)
      .set("Authorization", `Bearer ${accessToken}`);

    // Should fail validation or cap at 100
    expect(res.status).toBe(400);
  });

  it("calculates correct balances from ALL expenses (not just paginated)", async () => {
    const res = await request(app)
      .get(`/api/groups/${groupId}/summary?page=1&limit=5`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    // Even though only 5 expenses shown, net balance should reflect all 25
    // Each expense is 1000 minor with single participant = no debt
    expect(res.body.netBalances[userId]).toBe(0);
  });
});
