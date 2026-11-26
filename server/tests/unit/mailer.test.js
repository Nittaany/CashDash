import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("production mail delivery", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("../../src/config/env.js");
    vi.resetModules();
  });

  it("does not use mock transport when production email is unconfigured", async () => {
    vi.doMock("../../src/config/env.js", () => ({
      env: {
        NODE_ENV: "production",
        RESEND_API_KEY: undefined,
        MAIL_FROM: "CashDash <no-reply@example.com>",
        primaryClientUrl: "https://cashdash.example.com"
      }
    }));

    const { sendVerificationEmail, mockTransport } = await import("../../src/services/mailer.js");

    await expect(sendVerificationEmail("user@example.com", "token"))
      .rejects.toThrow("Email delivery is not configured");
    expect(mockTransport.sentEmails).toHaveLength(0);
  });
});
