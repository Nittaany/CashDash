import { describe, it, expect } from "vitest";
import { toMinorUnits, formatMoney } from "../utils/currency.js";

describe("toMinorUnits", () => {
  it("converts whole number string to minor units", () => {
    expect(toMinorUnits("100")).toBe(10000);
  });

  it("converts decimal string to minor units", () => {
    expect(toMinorUnits("100.50")).toBe(10050);
  });

  it("handles 19.99 correctly without float drift", () => {
    expect(toMinorUnits("19.99")).toBe(1999);
  });

  it("pads single decimal digit", () => {
    expect(toMinorUnits("5.5")).toBe(550);
  });

  it("rejects zero", () => {
    expect(toMinorUnits("0")).toBeNull();
    expect(toMinorUnits("0.00")).toBeNull();
  });

  it("rejects negative values", () => {
    expect(toMinorUnits("-5")).toBeNull();
    expect(toMinorUnits("-100.50")).toBeNull();
  });

  it("rejects non-numeric strings", () => {
    expect(toMinorUnits("abc")).toBeNull();
    expect(toMinorUnits("12.34.56")).toBeNull();
    expect(toMinorUnits("")).toBeNull();
  });

  it("rejects null and undefined", () => {
    expect(toMinorUnits(null)).toBeNull();
    expect(toMinorUnits(undefined)).toBeNull();
  });
});

describe("formatMoney", () => {
  it("formats NPR correctly", () => {
    expect(formatMoney(125050, "NPR")).toBe("NPR 1,250.50");
  });

  it("formats INR correctly", () => {
    expect(formatMoney(100000, "INR")).toBe("INR 1,000.00");
  });

  it("formats USD correctly", () => {
    expect(formatMoney(1250, "USD")).toBe("USD 12.50");
  });

  it("handles zero", () => {
    expect(formatMoney(0, "NPR")).toBe("NPR 0.00");
  });

  it("handles invalid input", () => {
    expect(formatMoney(NaN, "NPR")).toBe("NPR 0.00");
    expect(formatMoney(undefined, "NPR")).toBe("NPR 0.00");
  });

  it("defaults to NPR", () => {
    expect(formatMoney(1000)).toBe("NPR 10.00");
  });
});
