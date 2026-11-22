import { describe, it, expect, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import request from "supertest";
import jwt from "jsonwebtoken";
import User from "../../src/models/User.js";
import PersonalExpense from "../../src/models/PersonalExpense.js";
import Group from "../../src/models/Group.js";
import GroupExpense from "../../src/models/GroupExpense.js";
import Settlement from "../../src/models/Settlement.js";
import { app } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import "./setup.js";

function generateToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), email: user.email, isDemo: user.isDemo },
    env.JWT_ACCESS_SECRET,
    { algorithm: "HS256", expiresIn: "15m" }
  );
}

describe("TTL expiresAt propagation", () => {
  describe("normal user records have no expiresAt", () => {
    let normalUser;
    let normalUser2;
    let token;

    beforeEach(async () => {
      normalUser = await User.create({
        name: "Normal User",
        email: `normal-${Date.now()}@example.com`,
        passwordHash: await bcrypt.hash("password123", 10),
        currency: "NPR",
        walletBalanceMinor: 1000000
      });
      normalUser2 = await User.create({
        name: "Normal User 2",
        email: `normal2-${Date.now()}@example.com`,
        passwordHash: await bcrypt.hash("password123", 10),
        currency: "NPR"
      });
      token = generateToken(normalUser);
    });

    it("normal user document has no expiresAt", () => {
      expect(normalUser.expiresAt).toBeUndefined();
    });

    it("normal user's personal expense via API has no expiresAt", async () => {
      const res = await request(app)
        .post("/api/expenses")
        .set("Authorization", `Bearer ${token}`)
        .send({
          amountMinor: 5000,
          category: "Food",
          description: "Lunch",
          paymentMode: "WALLET",
          date: new Date().toISOString()
        });

      expect(res.status).toBe(201);
      expect(res.body.expense.expiresAt).toBeUndefined();

      const expense = await PersonalExpense.findById(res.body.expense._id);
      expect(expense.expiresAt).toBeUndefined();
    });

    it("normal user's group via API has no expiresAt", async () => {
      const res = await request(app)
        .post("/api/groups")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Normal Group", currency: "NPR" });

      expect(res.status).toBe(201);
      expect(res.body.group.expiresAt).toBeUndefined();

      const group = await Group.findById(res.body.group._id);
      expect(group.expiresAt).toBeUndefined();
    });

    it("normal user's group expense via API has no expiresAt", async () => {
      // Create group first
      const groupRes = await request(app)
        .post("/api/groups")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Expense Group", currency: "NPR" });

      const groupId = groupRes.body.group._id;

      const res = await request(app)
        .post(`/api/groups/${groupId}/expenses`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          description: "Test expense",
          amountMinor: 10000,
          payerId: normalUser._id.toString(),
          splitType: "EQUAL",
          participants: [normalUser._id.toString()]
        });

      expect(res.status).toBe(201);
      expect(res.body.expense.expiresAt).toBeUndefined();

      const expense = await GroupExpense.findById(res.body.expense._id);
      expect(expense.expiresAt).toBeUndefined();
    });
  });

  describe("demo user records have expiresAt equal to user's expiresAt", () => {
    let demoUser;
    let demoUser2;
    let token;
    let demoExpiresAt;

    beforeEach(async () => {
      demoExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

      demoUser = await User.create({
        name: "Demo User",
        email: `demo-${Date.now()}@cashdash.app`,
        passwordHash: await bcrypt.hash("password123", 10),
        currency: "NPR",
        walletBalanceMinor: 1000000,
        isDemo: true,
        expiresAt: demoExpiresAt
      });
      demoUser2 = await User.create({
        name: "Demo User 2",
        email: `demo2-${Date.now()}@cashdash.app`,
        passwordHash: await bcrypt.hash("password123", 10),
        currency: "NPR",
        isDemo: true,
        expiresAt: demoExpiresAt
      });
      token = generateToken(demoUser);
    });

    it("demo user's personal expense via API has expiresAt matching user", async () => {
      const res = await request(app)
        .post("/api/expenses")
        .set("Authorization", `Bearer ${token}`)
        .send({
          amountMinor: 5000,
          category: "Food",
          description: "Demo lunch",
          paymentMode: "WALLET",
          date: new Date().toISOString()
        });

      expect(res.status).toBe(201);
      
      const expense = await PersonalExpense.findById(res.body.expense._id);
      expect(expense.expiresAt).toBeInstanceOf(Date);
      expect(expense.expiresAt.getTime()).toBe(demoExpiresAt.getTime());
    });

    it("demo user's group via API has expiresAt matching user", async () => {
      const res = await request(app)
        .post("/api/groups")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Demo Group", currency: "NPR" });

      expect(res.status).toBe(201);

      const group = await Group.findById(res.body.group._id);
      expect(group.expiresAt).toBeInstanceOf(Date);
      expect(group.expiresAt.getTime()).toBe(demoExpiresAt.getTime());
    });

    it("demo user's group expense via API has expiresAt matching user", async () => {
      // Create group first
      const groupRes = await request(app)
        .post("/api/groups")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Demo Expense Group", currency: "NPR" });

      const groupId = groupRes.body.group._id;

      const res = await request(app)
        .post(`/api/groups/${groupId}/expenses`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          description: "Demo test expense",
          amountMinor: 10000,
          payerId: demoUser._id.toString(),
          splitType: "EQUAL",
          participants: [demoUser._id.toString()]
        });

      expect(res.status).toBe(201);

      const expense = await GroupExpense.findById(res.body.expense._id);
      expect(expense.expiresAt).toBeInstanceOf(Date);
      expect(expense.expiresAt.getTime()).toBe(demoExpiresAt.getTime());
    });
  });
});
