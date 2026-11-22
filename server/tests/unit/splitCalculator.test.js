import { describe, expect, it } from "vitest";
import { calculateSplits } from "../../src/services/splitCalculator.js";

describe("calculateSplits", () => {
  it("distributes 10000 minor units equally across three participants", () => {
    const splits = calculateSplits({
      amountMinor: 10000,
      splitType: "EQUAL",
      participants: ["A", "B", "C"]
    });

    expect(splits).toEqual([
      { userId: "A", amountMinor: 3334 },
      { userId: "B", amountMinor: 3333 },
      { userId: "C", amountMinor: 3333 }
    ]);
    expect(splits.reduce((sum, split) => sum + split.amountMinor, 0)).toBe(10000);
  });

  it("accepts exact shares that sum to the total", () => {
    const splits = calculateSplits({
      amountMinor: 10000,
      splitType: "EXACT",
      participants: ["A", "B"],
      exactSharesMinor: { A: 6000, B: 4000 }
    });

    expect(splits.map((split) => split.amountMinor)).toEqual([6000, 4000]);
  });

  it("rejects exact shares that do not sum to the total", () => {
    expect(() =>
      calculateSplits({
        amountMinor: 10000,
        splitType: "EXACT",
        participants: ["A", "B"],
        exactSharesMinor: { A: 6000, B: 3000 }
      })
    ).toThrow(/sum to amountMinor/i);
  });

  it("rejects zero or negative exact shares", () => {
    expect(() =>
      calculateSplits({
        amountMinor: 10000,
        splitType: "EXACT",
        participants: ["A", "B"],
        exactSharesMinor: { A: 10000, B: 0 }
      })
    ).toThrow(/positive integer/i);
  });

  it("rejects exact shares from stale participants", () => {
    expect(() =>
      calculateSplits({
        amountMinor: 10000,
        splitType: "EXACT",
        participants: ["A", "B"],
        exactSharesMinor: { A: 5000, B: 5000, C: 1 }
      })
    ).toThrow(/outside the active set/i);
  });

  it("distributes percentage rounding deterministically", () => {
    const splits = calculateSplits({
      amountMinor: 10000,
      splitType: "PERCENT",
      participants: ["A", "B", "C"],
      percentShares: { A: 33.33, B: 33.33, C: 33.34 }
    });

    expect(splits.map((split) => split.amountMinor)).toEqual([3333, 3333, 3334]);
    expect(splits.reduce((sum, split) => sum + split.amountMinor, 0)).toBe(10000);
  });

  it("rejects percentages that do not sum to 100", () => {
    expect(() =>
      calculateSplits({
        amountMinor: 10000,
        splitType: "PERCENT",
        participants: ["A", "B"],
        percentShares: { A: 40, B: 40 }
      })
    ).toThrow(/sum to 100/i);
  });

  it("rejects stale percentage participants", () => {
    expect(() =>
      calculateSplits({
        amountMinor: 10000,
        splitType: "PERCENT",
        participants: ["A", "B"],
        percentShares: { A: 50, C: 50 }
      })
    ).toThrow(/outside the active set/i);
  });

  it.each([0, -1, 1.5])("rejects invalid amountMinor %i", (amountMinor) => {
    expect(() =>
      calculateSplits({
        amountMinor,
        splitType: "EQUAL",
        participants: ["A", "B"]
      })
    ).toThrow(/positive integer/i);
  });

  // Additional coverage tests
  it("rejects empty participants array", () => {
    expect(() =>
      calculateSplits({
        amountMinor: 10000,
        splitType: "EQUAL",
        participants: []
      })
    ).toThrow(/at least one/i);
  });

  it("rejects duplicate participants", () => {
    expect(() =>
      calculateSplits({
        amountMinor: 10000,
        splitType: "EQUAL",
        participants: ["A", "A", "B"]
      })
    ).toThrow(/unique/i);
  });

  it("rejects invalid splitType", () => {
    expect(() =>
      calculateSplits({
        amountMinor: 10000,
        splitType: "INVALID",
        participants: ["A", "B"]
      })
    ).toThrow(/splitType must be/i);
  });

  it("accepts exact shares as array", () => {
    const splits = calculateSplits({
      amountMinor: 10000,
      splitType: "EXACT",
      participants: ["A", "B"],
      exactSharesMinor: [6000, 4000]
    });
    expect(splits.map((s) => s.amountMinor)).toEqual([6000, 4000]);
  });

  it("rejects exact shares array with wrong length", () => {
    expect(() =>
      calculateSplits({
        amountMinor: 10000,
        splitType: "EXACT",
        participants: ["A", "B", "C"],
        exactSharesMinor: [6000, 4000]
      })
    ).toThrow(/exactly the active participants/i);
  });

  it("rejects missing exactSharesMinor for EXACT split", () => {
    expect(() =>
      calculateSplits({
        amountMinor: 10000,
        splitType: "EXACT",
        participants: ["A", "B"]
      })
    ).toThrow(/exactSharesMinor is required/i);
  });

  it("rejects missing percentShares for PERCENT split", () => {
    expect(() =>
      calculateSplits({
        amountMinor: 10000,
        splitType: "PERCENT",
        participants: ["A", "B"]
      })
    ).toThrow(/percentShares is required/i);
  });

  it("accepts percent shares as array", () => {
    const splits = calculateSplits({
      amountMinor: 10000,
      splitType: "PERCENT",
      participants: ["A", "B"],
      percentShares: [60, 40]
    });
    expect(splits.reduce((s, x) => s + x.amountMinor, 0)).toBe(10000);
  });

  it("rejects percent shares array with wrong length", () => {
    expect(() =>
      calculateSplits({
        amountMinor: 10000,
        splitType: "PERCENT",
        participants: ["A", "B", "C"],
        percentShares: [50, 50]
      })
    ).toThrow(/exactly the active participants/i);
  });

  it("rejects zero or negative percentage", () => {
    expect(() =>
      calculateSplits({
        amountMinor: 10000,
        splitType: "PERCENT",
        participants: ["A", "B"],
        percentShares: { A: 100, B: 0 }
      })
    ).toThrow(/positive numbers/i);
  });

  it("normalizes participant objects with _id", () => {
    const splits = calculateSplits({
      amountMinor: 10000,
      splitType: "EQUAL",
      participants: [{ _id: "A" }, { _id: "B" }]
    });
    expect(splits[0].userId).toBe("A");
  });

  it("normalizes participant objects with userId", () => {
    const splits = calculateSplits({
      amountMinor: 10000,
      splitType: "EQUAL",
      participants: [{ userId: "A" }, { userId: "B" }]
    });
    expect(splits[0].userId).toBe("A");
  });

  it("rejects participant with empty id", () => {
    expect(() =>
      calculateSplits({
        amountMinor: 10000,
        splitType: "EQUAL",
        participants: [{ _id: "" }, { _id: "B" }]
      })
    ).toThrow(/non-empty/i);
  });

  it("handles exact shares where participant missing in map", () => {
    expect(() =>
      calculateSplits({
        amountMinor: 10000,
        splitType: "EXACT",
        participants: ["A", "B", "C"],
        exactSharesMinor: { A: 5000, B: 5000 } // C missing
      })
    ).toThrow(/exactly the active participants/i);
  });

  it("handles percent shares where participant missing in map", () => {
    expect(() =>
      calculateSplits({
        amountMinor: 10000,
        splitType: "PERCENT",
        participants: ["A", "B", "C"],
        percentShares: { A: 50, B: 50 } // C missing
      })
    ).toThrow(/exactly the active participants/i);
  });
});
