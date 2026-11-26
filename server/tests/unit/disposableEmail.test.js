import { afterEach, describe, expect, it, vi } from "vitest";
import { isDisposableEmailAddress } from "../../src/services/disposableEmail.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("disposable email domain service", () => {
  it("accepts ordinary email domains", () => {
    expect(isDisposableEmailAddress("person@example.com")).toBe(false);
  });

  it("rejects known disposable domains and their subdomains", () => {
    expect(isDisposableEmailAddress("person@mailinator.com")).toBe(true);
    expect(isDisposableEmailAddress("person@sub.mailinator.com")).toBe(true);
    expect(isDisposableEmailAddress("person@MAILINATOR.COM")).toBe(true);
  });

  it("checks the bundled domain list without making a network request", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    expect(isDisposableEmailAddress("person@mailinator.com")).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
