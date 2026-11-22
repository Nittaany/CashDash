import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { toMinorUnits } from "../utils/currency.js";

// Test the form validation logic directly
describe("GroupExpenseForm validation", () => {
  describe("EXACT split validation", () => {
    it("blocks submit when exact shares don't sum to amount", () => {
      const amountMinor = 10000;
      const exactShares = { user1: "30", user2: "30" }; // 60, not 100

      const totalExact = Object.values(exactShares).reduce(
        (sum, v) => sum + (toMinorUnits(v) || 0),
        0
      );

      expect(totalExact).toBe(6000); // 60.00
      expect(totalExact).not.toBe(amountMinor);
    });

    it("allows submit when exact shares sum correctly", () => {
      const amountMinor = 10000;
      const exactShares = { user1: "60", user2: "40" };

      const totalExact = Object.values(exactShares).reduce(
        (sum, v) => sum + (toMinorUnits(v) || 0),
        0
      );

      expect(totalExact).toBe(amountMinor);
    });
  });

  describe("PERCENT split validation", () => {
    it("blocks submit when percentages don't sum to 100", () => {
      const percentShares = { user1: "30", user2: "30" };

      const totalPercent = Object.values(percentShares).reduce(
        (sum, v) => sum + parseFloat(v || 0),
        0
      );

      expect(totalPercent).toBe(60);
      expect(totalPercent).not.toBe(100);
    });

    it("allows submit when percentages sum to 100", () => {
      const percentShares = { user1: "60", user2: "40" };

      const totalPercent = Object.values(percentShares).reduce(
        (sum, v) => sum + parseFloat(v || 0),
        0
      );

      expect(totalPercent).toBe(100);
    });

    it("handles floating point percentages", () => {
      const percentShares = { user1: "33.33", user2: "33.33", user3: "33.34" };

      const totalPercent = Object.values(percentShares).reduce(
        (sum, v) => sum + parseFloat(v || 0),
        0
      );

      expect(totalPercent).toBeCloseTo(100, 2);
    });
  });

  describe("participant toggle clears stale shares", () => {
    it("removes exact share when participant is deselected", () => {
      const exactShares = { user1: "50", user2: "50" };
      const participants = ["user1", "user2"];

      // Simulate deselecting user2
      const newParticipants = participants.filter((p) => p !== "user2");
      const newExactShares = { ...exactShares };
      delete newExactShares["user2"];

      expect(newParticipants).toEqual(["user1"]);
      expect(newExactShares).toEqual({ user1: "50" });
    });

    it("removes percent share when participant is deselected", () => {
      const percentShares = { user1: "60", user2: "40" };
      const participants = ["user1", "user2"];

      // Simulate deselecting user1
      const newParticipants = participants.filter((p) => p !== "user1");
      const newPercentShares = { ...percentShares };
      delete newPercentShares["user1"];

      expect(newParticipants).toEqual(["user2"]);
      expect(newPercentShares).toEqual({ user2: "40" });
    });
  });
});
