import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import User from "../../src/models/User.js";
import "./setup.js";

describe("Wallet & Expenses Routes", () => {
  let accessToken;
  let userId;

  beforeEach(async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Wallet Test",
        email: "wallet@example.com",
        password: "WalletPass123"
      });
    accessToken = res.body.accessToken;
    userId = res.body.user.id;
  });

  describe("GET /api/wallet", () => {
    it("returns wallet balance and summary", async () => {
      const res = await request(app)
        .get("/api/wallet")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.walletBalanceMinor).toBe(0);
      expect(res.body.currency).toBe("NPR");
      expect(res.body.monthlySummary).toBeDefined();
    });
  });

  describe("POST /api/wallet/topup", () => {
    it("adds funds to wallet", async () => {
      const res = await request(app)
        .post("/api/wallet/topup")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ amountMinor: 100000 });

      expect(res.status).toBe(200);
      expect(res.body.walletBalanceMinor).toBe(100000);
    });

    it("rejects negative amount", async () => {
      const res = await request(app)
        .post("/api/wallet/topup")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ amountMinor: -5000 });

      expect(res.status).toBe(400);
    });

    it("rejects zero amount", async () => {
      const res = await request(app)
        .post("/api/wallet/topup")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ amountMinor: 0 });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/expenses", () => {
    beforeEach(async () => {
      // Top up wallet first
      await request(app)
        .post("/api/wallet/topup")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ amountMinor: 50000 });
    });

    it("creates expense and deducts from wallet atomically", async () => {
      const res = await request(app)
        .post("/api/expenses")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          amountMinor: 15000,
          category: "Food",
          description: "Lunch",
          paymentMode: "WALLET",
          date: new Date().toISOString()
        });

      expect(res.status).toBe(201);
      expect(res.body.expense.amountMinor).toBe(15000);

      // Verify wallet balance decreased
      const walletRes = await request(app)
        .get("/api/wallet")
        .set("Authorization", `Bearer ${accessToken}`);
      expect(walletRes.body.walletBalanceMinor).toBe(35000);
    });

    it("rejects expense exceeding wallet balance", async () => {
      const res = await request(app)
        .post("/api/expenses")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          amountMinor: 100000, // More than 50000
          category: "Food",
          description: "Expensive lunch",
          paymentMode: "WALLET",
          date: new Date().toISOString()
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Insufficient");

      // Verify wallet balance unchanged
      const walletRes = await request(app)
        .get("/api/wallet")
        .set("Authorization", `Bearer ${accessToken}`);
      expect(walletRes.body.walletBalanceMinor).toBe(50000);
    });
  });

  describe("DELETE /api/expenses/:id", () => {
    let expenseId;

    beforeEach(async () => {
      // Top up and create expense
      await request(app)
        .post("/api/wallet/topup")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ amountMinor: 50000 });

      const expRes = await request(app)
        .post("/api/expenses")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          amountMinor: 20000,
          category: "Transport",
          description: "Taxi",
          paymentMode: "CASH",
          date: new Date().toISOString()
        });
      expenseId = expRes.body.expense._id;
    });

    it("deletes expense and refunds wallet", async () => {
      const res = await request(app)
        .delete(`/api/expenses/${expenseId}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);

      // Verify wallet refunded
      const walletRes = await request(app)
        .get("/api/wallet")
        .set("Authorization", `Bearer ${accessToken}`);
      expect(walletRes.body.walletBalanceMinor).toBe(50000); // Full balance restored
    });

    it("rejects cross-user delete", async () => {
      // Create another user
      const otherRes = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Other User",
          email: "other@example.com",
          password: "OtherPass123"
        });

      const res = await request(app)
        .delete(`/api/expenses/${expenseId}`)
        .set("Authorization", `Bearer ${otherRes.body.accessToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe("Concurrent expense test", () => {
    it("handles concurrent expenses correctly - only succeeds up to balance", async () => {
      // Set wallet balance to exactly 500
      await request(app)
        .post("/api/wallet/topup")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ amountMinor: 500 });

      // Create 10 concurrent expense requests of 100 each
      const promises = Array(10).fill(null).map(() =>
        request(app)
          .post("/api/expenses")
          .set("Authorization", `Bearer ${accessToken}`)
          .send({
            amountMinor: 100,
            category: "Test",
            description: "Concurrent test",
            paymentMode: "WALLET",
            date: new Date().toISOString()
          })
      );

      const results = await Promise.all(promises);
      const successes = results.filter((r) => r.status === 201);
      const failures = results.filter((r) => r.status === 400);

      // Exactly 5 should succeed (500 / 100 = 5)
      expect(successes.length).toBe(5);
      expect(failures.length).toBe(5);

      // Final balance should be 0
      const walletRes = await request(app)
        .get("/api/wallet")
        .set("Authorization", `Bearer ${accessToken}`);
      expect(walletRes.body.walletBalanceMinor).toBe(0);
    });
  });
});
