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

describe("currency round-trip", () => {
  it("preserves exact value through toMinorUnits -> formatMoney", () => {
    const inputs = ["1.00", "19.99", "100.50", "999.99", "1234.56"];

    for (const input of inputs) {
      const minorUnits = toMinorUnits(input);
      const formatted = formatMoney(minorUnits, "NPR");
      // Extract the numeric part from formatted string
      const match = formatted.match(/[\d,]+\.\d{2}/);
      const roundTrip = match[0].replace(/,/g, "");
      expect(roundTrip).toBe(input);
    }
  });

  it("handles edge case amounts without floating point errors", () => {
    // 0.1 + 0.2 !== 0.3 in floating point, but our integer math should work
    const a = toMinorUnits("0.1"); // 10
    const b = toMinorUnits("0.2"); // 20
    const sum = a + b; // 30

    expect(sum).toBe(30);
    expect(formatMoney(sum, "USD")).toBe("USD 0.30");
  });

  it("handles large amounts without precision loss", () => {
    const large = toMinorUnits("9999999.99");
    expect(large).toBe(999999999);
    // formatMoney uses en-IN locale which formats as 99,99,999.99
    const formatted = formatMoney(large, "NPR");
    expect(formatted).toMatch(/9,?9,?9,?9,?9,?9,?9\.99/);
  });
});

