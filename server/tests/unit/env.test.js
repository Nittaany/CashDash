import { describe, it, expect } from "vitest";
import * as envConfig from "../../src/config/env.js";

const { clientUrlSchema } = envConfig;

describe("CLIENT_URL validation", () => {
  it("accepts a single valid origin", () => {
    expect(() => clientUrlSchema.parse("http://localhost:3000")).not.toThrow();
    expect(() => clientUrlSchema.parse("https://example.com")).not.toThrow();
  });

  it("accepts a valid pair of origins", () => {
    expect(() => clientUrlSchema.parse("http://localhost:3000, https://cashdash.example.com")).not.toThrow();
    expect(() => clientUrlSchema.parse("http://localhost:3000,https://example.com")).not.toThrow();
    expect(() => clientUrlSchema.parse("http://localhost:3000,https://a.example.com")).not.toThrow();
  });

  it("rejects non-URL entry in list", () => {
    expect(() => clientUrlSchema.parse("not-a-url,http://ok.com")).toThrow();
    expect(() => clientUrlSchema.parse("http://ok.com,not-a-url")).toThrow();
  });

  it("rejects URL with path", () => {
    expect(() => clientUrlSchema.parse("http://x.com/")).toThrow();
    expect(() => clientUrlSchema.parse("http://x.com/path")).toThrow();
    expect(() => clientUrlSchema.parse("https://example.com/api")).toThrow();
  });

  it("rejects URL with trailing slash", () => {
    expect(() => clientUrlSchema.parse("http://localhost:3000/")).toThrow();
  });

  it("rejects non-http(s) protocols", () => {
    expect(() => clientUrlSchema.parse("ftp://example.com")).toThrow();
    expect(() => clientUrlSchema.parse("ws://example.com")).toThrow();
  });

  it("rejects empty string", () => {
    expect(() => clientUrlSchema.parse("")).toThrow();
  });

  it("rejects production verification without a real mail provider key", () => {
    const result = envConfig.envSchema?.safeParse({
      MONGODB_URI: "mongodb://localhost:27017/cashdash",
      JWT_ACCESS_SECRET: "a".repeat(32),
      JWT_REFRESH_SECRET: "b".repeat(32),
      CLIENT_URL: "https://cashdash.example.com",
      NODE_ENV: "production",
      REQUIRE_EMAIL_VERIFICATION: "true"
    });

    expect(result?.success).toBe(false);
  });

  it("accepts production verification when real mail delivery is configured", () => {
    const result = envConfig.envSchema?.safeParse({
      MONGODB_URI: "mongodb://localhost:27017/cashdash",
      JWT_ACCESS_SECRET: "a".repeat(32),
      JWT_REFRESH_SECRET: "b".repeat(32),
      CLIENT_URL: "https://cashdash.example.com",
      NODE_ENV: "production",
      REQUIRE_EMAIL_VERIFICATION: "true",
      RESEND_API_KEY: "re_test_key"
    });

    expect(result?.success).toBe(true);
  });

  it("rejects partial OAuth provider credentials", () => {
    const result = envConfig.envSchema?.safeParse({
      MONGODB_URI: "mongodb://localhost:27017/cashdash",
      JWT_ACCESS_SECRET: "a".repeat(32),
      JWT_REFRESH_SECRET: "b".repeat(32),
      CLIENT_URL: "https://cashdash.example.com",
      GOOGLE_CLIENT_ID: "google-client-id"
    });

    expect(result?.success).toBe(false);
  });

  it("accepts complete OAuth credentials with a state signing secret", () => {
    const result = envConfig.envSchema?.safeParse({
      MONGODB_URI: "mongodb://localhost:27017/cashdash",
      JWT_ACCESS_SECRET: "a".repeat(32),
      JWT_REFRESH_SECRET: "b".repeat(32),
      CLIENT_URL: "https://cashdash.example.com",
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
      OAUTH_STATE_SECRET: "c".repeat(32)
    });

    expect(result?.success).toBe(true);
  });
});
