import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api, checkApiHealth, setAccessToken, clearAccessToken } from "../api/client.js";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("API client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAccessToken();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("retries demo login up to three times for transient proxy statuses", async () => {
    vi.useFakeTimers();
    mockFetch
      .mockResolvedValueOnce({ status: 502, ok: false })
      .mockResolvedValueOnce({ status: 503, ok: false })
      .mockResolvedValueOnce({ status: 504, ok: false })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: () => Promise.resolve({ accessToken: "demo-token" })
      });

    const request = api.post("/api/auth/demo", {});
    await vi.runAllTimersAsync();

    await expect(request).resolves.toEqual({ accessToken: "demo-token" });
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it("retries health checks after network failures up to three times", async () => {
    vi.useFakeTimers();
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));

    const request = checkApiHealth();
    await vi.runAllTimersAsync();

    await expect(request).resolves.toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it("does not retry transient errors for other endpoints", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 503,
      ok: false,
      json: () => Promise.resolve({ error: "Unavailable" })
    });

    await expect(api.get("/api/wallet")).rejects.toThrow("Unavailable");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries once after 401 with silent refresh", async () => {
    setAccessToken("old-token");

    // First call returns 401
    mockFetch.mockResolvedValueOnce({
      status: 401,
      ok: false,
      json: () => Promise.resolve({ error: "Unauthorized" })
    });

    // Refresh succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ accessToken: "new-token" })
    });

    // Retry succeeds
    mockFetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ data: "success" })
    });

    const result = await api.get("/api/wallet");

    expect(result).toEqual({ data: "success" });
    expect(mockFetch).toHaveBeenCalledTimes(3);

    // Verify the retry used new token
    const retryCall = mockFetch.mock.calls[2];
    expect(retryCall[1].headers.Authorization).toBe("Bearer new-token");
  });

  it("does not retry if refresh fails", async () => {
    setAccessToken("old-token");

    // First call returns 401
    mockFetch.mockResolvedValueOnce({
      status: 401,
      ok: false,
      json: () => Promise.resolve({ error: "Unauthorized" })
    });

    // Refresh fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Refresh failed" })
    });

    await expect(api.get("/api/wallet")).rejects.toThrow("Unauthorized");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry auth endpoints on 401", async () => {
    // Login returns 401
    mockFetch.mockResolvedValueOnce({
      status: 401,
      ok: false,
      json: () => Promise.resolve({ error: "Invalid credentials" })
    });

    await expect(api.post("/api/auth/login", { email: "a@b.com", password: "x" }))
      .rejects.toThrow("Invalid credentials");

    // Should not attempt refresh
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("only retries once (no infinite loop)", async () => {
    setAccessToken("token");

    // All calls return 401
    mockFetch.mockResolvedValue({
      status: 401,
      ok: false,
      json: () => Promise.resolve({ error: "Unauthorized" })
    });

    await expect(api.get("/api/wallet")).rejects.toThrow();

    // Should be: original + refresh + retry (max 3)
    expect(mockFetch.mock.calls.length).toBeLessThanOrEqual(3);
  });
});
