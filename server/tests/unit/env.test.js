import { describe, it, expect } from "vitest";
import { clientUrlSchema } from "../../src/config/env.js";

describe("CLIENT_URL validation", () => {
  it("accepts a single valid origin", () => {
    expect(() => clientUrlSchema.parse("http://localhost:3000")).not.toThrow();
    expect(() => clientUrlSchema.parse("https://example.com")).not.toThrow();
  });

  it("accepts a valid pair of origins", () => {
    expect(() => clientUrlSchema.parse("http://localhost:3000, https://cashdash.example.com")).not.toThrow();
    expect(() => clientUrlSchema.parse("http://localhost:3000,https://example.com")).not.toThrow();
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
});
