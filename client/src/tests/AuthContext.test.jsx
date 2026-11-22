import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "../context/AuthContext.jsx";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Test component to access auth context
function TestConsumer() {
  const { user, loading, serverWaking } = useAuth();
  return (
    <div>
      <span data-testid="loading">{loading.toString()}</span>
      <span data-testid="serverWaking">{serverWaking.toString()}</span>
      <span data-testid="user">{user ? user.email : "null"}</span>
    </div>
  );
}

function renderWithAuth() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    </BrowserRouter>
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls health check on mount", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true }); // health check
    mockFetch.mockResolvedValueOnce({ ok: false }); // refresh fails

    renderWithAuth();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/health");
    });
  });

  it("sets serverWaking true during health check", async () => {
    let resolveHealth;
    mockFetch.mockImplementationOnce(() => new Promise((r) => { resolveHealth = r; }));

    renderWithAuth();

    // Should show serverWaking initially
    expect(screen.getByTestId("serverWaking").textContent).toBe("true");

    // Resolve health check
    resolveHealth({ ok: true });
    mockFetch.mockResolvedValueOnce({ ok: false }); // refresh

    await waitFor(() => {
      expect(screen.getByTestId("serverWaking").textContent).toBe("false");
    });
  });

  it("attempts silent refresh after successful health check", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true }); // health check
    mockFetch.mockResolvedValueOnce({ // refresh succeeds
      ok: true,
      json: () => Promise.resolve({ accessToken: "test-token" })
    });
    mockFetch.mockResolvedValueOnce({ // /api/auth/me
      ok: true,
      json: () => Promise.resolve({ user: { email: "test@example.com" } })
    });

    renderWithAuth();

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("test@example.com");
    });
  });

  it("handles failed health check gracefully", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false }); // health check fails

    renderWithAuth();

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
      expect(screen.getByTestId("user").textContent).toBe("null");
    });
  });
});
