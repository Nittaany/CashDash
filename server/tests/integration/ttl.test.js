import { describe, it, expect, beforeEach, afterEach } from "vitest";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../../src/models/User.js";
import PersonalExpense from "../../src/models/PersonalExpense.js";
import Group from "../../src/models/Group.js";
import GroupExpense from "../../src/models/GroupExpense.js";
import Settlement from "../../src/models/Settlement.js";
import { createEphemeralDemoUser } from "../../src/services/demoSeed.js";
import "./setup.js";

describe("TTL expiresAt safety", () => {
  describe("normal user data has no expiresAt", () => {
    let normalUser;

    beforeEach(async () => {
      normalUser = await User.create({
        name: "Normal User",
        email: `normal-${Date.now()}@example.com`,
        passwordHash: await bcrypt.hash("password123", 10),
        currency: "NPR",
        walletBalanceMinor: 100000
      });
    });

    afterEach(async () => {
      if (normalUser) {
        await User.findByIdAndDelete(normalUser._id);
      }
    });

    it("normal user document has no expiresAt", () => {
      expect(normalUser.expiresAt).toBeUndefined();
    });

    it("normal user's personal expense has no expiresAt", async () => {
      const expense = await PersonalExpense.create({
        userId: normalUser._id,
        amountMinor: 5000,
        category: "Food",
        description: "Lunch",
        paymentMode: "CASH",
        date: new Date()
      });

      expect(expense.expiresAt).toBeUndefined();
      await PersonalExpense.findByIdAndDelete(expense._id);
    });

    it("normal user's group has no expiresAt", async () => {
      const group = await Group.create({
        name: "Normal Group",
        currency: "NPR",
        createdBy: normalUser._id,
        members: [normalUser._id]
      });

      expect(group.expiresAt).toBeUndefined();
      await Group.findByIdAndDelete(group._id);
    });

    it("normal user's group expense has no expiresAt", async () => {
      const group = await Group.create({
        name: "Test Group",
        currency: "NPR",
        createdBy: normalUser._id,
        members: [normalUser._id]
      });

      const groupExpense = await GroupExpense.create({
        groupId: group._id,
        payerId: normalUser._id,
        description: "Test expense",
        amountMinor: 10000,
        splitType: "EQUAL",
        splits: [{ userId: normalUser._id, amountMinor: 10000 }],
        date: new Date()
      });

      expect(groupExpense.expiresAt).toBeUndefined();
      await GroupExpense.findByIdAndDelete(groupExpense._id);
      await Group.findByIdAndDelete(group._id);
    });

    it("normal user's settlement has no expiresAt", async () => {
      const user2 = await User.create({
        name: "User 2",
        email: `user2-${Date.now()}@example.com`,
        passwordHash: await bcrypt.hash("password123", 10),
        currency: "NPR"
      });

      const group = await Group.create({
        name: "Settlement Group",
        currency: "NPR",
        createdBy: normalUser._id,
        members: [normalUser._id, user2._id]
      });

      const settlement = await Settlement.create({
        groupId: group._id,
        fromUserId: normalUser._id,
        toUserId: user2._id,
        amountMinor: 5000,
        note: "Test settlement"
      });

      expect(settlement.expiresAt).toBeUndefined();
      await Settlement.findByIdAndDelete(settlement._id);
      await Group.findByIdAndDelete(group._id);
      await User.findByIdAndDelete(user2._id);
    });
  });

  describe("demo user data has expiresAt set", () => {
    let demoUser;

    beforeEach(async () => {
      demoUser = await createEphemeralDemoUser();
    });

    it("demo user document has expiresAt", () => {
      expect(demoUser.expiresAt).toBeInstanceOf(Date);
      expect(demoUser.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("demo user's personal expenses have expiresAt", async () => {
      const expenses = await PersonalExpense.find({ userId: demoUser._id });
      expect(expenses.length).toBeGreaterThan(0);
      
      for (const expense of expenses) {
        expect(expense.expiresAt).toBeInstanceOf(Date);
      }
    });

    it("demo user's group has expiresAt", async () => {
      const groups = await Group.find({ createdBy: demoUser._id });
      expect(groups.length).toBeGreaterThan(0);
      
      for (const group of groups) {
        expect(group.expiresAt).toBeInstanceOf(Date);
      }
    });

    it("demo user's group expenses have expiresAt", async () => {
      const groups = await Group.find({ createdBy: demoUser._id });
      const groupIds = groups.map(g => g._id);
      
      const groupExpenses = await GroupExpense.find({ groupId: { $in: groupIds } });
      expect(groupExpenses.length).toBeGreaterThan(0);
      
      for (const expense of groupExpenses) {
        expect(expense.expiresAt).toBeInstanceOf(Date);
      }
    });
  });
});
