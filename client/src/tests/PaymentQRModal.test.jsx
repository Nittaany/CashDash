import { describe, it, expect } from "vitest";
import { buildUpiUri } from "../components/PaymentQRModal.jsx";

describe("buildUpiUri", () => {
  it("builds a valid UPI URI with all parameters", () => {
    const uri = buildUpiUri("user@upi", "John Doe", 100.5, "INR");
    
    expect(uri).toContain("upi://pay?");
    expect(uri).toContain("pa=user%40upi");
    expect(uri).toContain("pn=John+Doe");
    expect(uri).toContain("am=100.50");
    expect(uri).toContain("cu=INR");
  });

  it("properly encodes special characters in payee handle", () => {
    const uri = buildUpiUri("user+test@bank", "Name", 50, "NPR");
    
    expect(uri).toContain("pa=user%2Btest%40bank");
  });

  it("formats amount to 2 decimal places", () => {
    const uri = buildUpiUri("user@upi", "Name", 99.999, "USD");
    
    expect(uri).toContain("am=100.00");
  });

  it("handles integer amounts", () => {
    const uri = buildUpiUri("user@upi", "Name", 500, "INR");
    
    expect(uri).toContain("am=500.00");
  });

  it("handles names with spaces", () => {
    const uri = buildUpiUri("user@upi", "John Smith Jr", 100, "INR");
    
    expect(uri).toContain("pn=John+Smith+Jr");
  });
});
