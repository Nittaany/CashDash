import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { buildUpiUri, isValidUpiVpa, PaymentQRModal } from "../components/PaymentQRModal.jsx";

describe("isValidUpiVpa", () => {
  it("accepts valid UPI VPA formats", () => {
    expect(isValidUpiVpa("user@upi")).toBe(true);
    expect(isValidUpiVpa("user123@paytm")).toBe(true);
    expect(isValidUpiVpa("user.name@okaxis")).toBe(true);
    expect(isValidUpiVpa("user-name@ybl")).toBe(true);
    expect(isValidUpiVpa("user_name@icici")).toBe(true);
  });

  it("rejects invalid UPI VPA formats", () => {
    expect(isValidUpiVpa("")).toBe(false);
    expect(isValidUpiVpa("user")).toBe(false); // no @
    expect(isValidUpiVpa("@upi")).toBe(false); // no local part
    expect(isValidUpiVpa("user@")).toBe(false); // no domain
    expect(isValidUpiVpa("user@a")).toBe(false); // domain too short
    expect(isValidUpiVpa("u@upi")).toBe(false); // local too short
    expect(isValidUpiVpa("user@upi123")).toBe(false); // digits in domain
    expect(isValidUpiVpa("esewa:9841234567")).toBe(false); // eSewa format
    expect(isValidUpiVpa(null)).toBe(false);
    expect(isValidUpiVpa(undefined)).toBe(false);
    expect(isValidUpiVpa(123)).toBe(false);
  });
});

describe("buildUpiUri", () => {
  it("builds valid UPI URI with integer math formatting", () => {
    const uri = buildUpiUri("user@upi", "John Doe", 10050);
    
    expect(uri).toContain("upi://pay?");
    expect(uri).toContain("pa=user%40upi");
    expect(uri).toContain("pn=John%20Doe");
    expect(uri).toContain("am=100.50"); // 10050 paisa = 100.50
    expect(uri).toContain("cu=INR");
  });

  it("formats small amounts correctly (under 1 rupee)", () => {
    const uri = buildUpiUri("user@upi", "Name", 5);
    expect(uri).toContain("am=0.05"); // 5 paisa = 0.05
  });

  it("formats amounts with trailing zeros correctly", () => {
    const uri = buildUpiUri("user@upi", "Name", 10000);
    expect(uri).toContain("am=100.00"); // 10000 paisa = 100.00
  });

  it("formats single digit paisa correctly", () => {
    const uri = buildUpiUri("user@upi", "Name", 101);
    expect(uri).toContain("am=1.01"); // 101 paisa = 1.01
  });

  it("returns null for invalid VPA", () => {
    expect(buildUpiUri("invalid", "Name", 1000)).toBe(null);
    expect(buildUpiUri("esewa:123", "Name", 1000)).toBe(null);
  });

  it("returns null for invalid amounts", () => {
    expect(buildUpiUri("user@upi", "Name", 0)).toBe(null);
    expect(buildUpiUri("user@upi", "Name", -100)).toBe(null);
    expect(buildUpiUri("user@upi", "Name", 100.5)).toBe(null); // not integer
  });

  it("returns null when the payee name is missing", () => {
    expect(buildUpiUri("user@upi", "", 1000)).toBe(null);
    expect(buildUpiUri("user@upi", undefined, 1000)).toBe(null);
  });
});

describe("PaymentQRModal", () => {
  it("renders QR code for INR with valid UPI VPA", () => {
    render(
      <PaymentQRModal
        isOpen={true}
        onClose={() => {}}
        payeeHandle="user@upi"
        payeeName="John"
        amountMinor={10000}
        currency="INR"
      />
    );

    expect(screen.getByText("Pay John")).toBeInTheDocument();
    expect(screen.getByText("INR 100.00")).toBeInTheDocument();
    expect(screen.getByText("user@upi")).toBeInTheDocument();
    // QR code should be rendered (svg element)
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("does not render QR code for non-INR currency", () => {
    render(
      <PaymentQRModal
        isOpen={true}
        onClose={() => {}}
        payeeHandle="user@upi"
        payeeName="John"
        amountMinor={10000}
        currency="NPR"
      />
    );

    expect(screen.getByText("Pay John")).toBeInTheDocument();
    expect(screen.getByText("NPR 100.00")).toBeInTheDocument();
    expect(screen.getByText(/UPI QR is only available for INR/)).toBeInTheDocument();
  });

  it("does not render QR code for invalid UPI VPA", () => {
    render(
      <PaymentQRModal
        isOpen={true}
        onClose={() => {}}
        payeeHandle="esewa:9841234567"
        payeeName="John"
        amountMinor={10000}
        currency="INR"
      />
    );

    expect(screen.getByText(/Invalid UPI ID format/)).toBeInTheDocument();
  });

  it("shows payment handle for USD without QR", () => {
    render(
      <PaymentQRModal
        isOpen={true}
        onClose={() => {}}
        payeeHandle="paypal@example.com"
        payeeName="Jane"
        amountMinor={5000}
        currency="USD"
      />
    );

    expect(screen.getByText("USD 50.00")).toBeInTheDocument();
    expect(screen.getByText("paypal@example.com")).toBeInTheDocument();
    expect(screen.getByText(/UPI QR is only available for INR/)).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    render(
      <PaymentQRModal
        isOpen={false}
        onClose={() => {}}
        payeeHandle="user@upi"
        payeeName="John"
        amountMinor={10000}
        currency="INR"
      />
    );

    expect(screen.queryByText("Pay John")).not.toBeInTheDocument();
  });
});
