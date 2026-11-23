import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "../context/AuthContext.jsx";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Test component to access auth context
function TestConsumer() {
  const { user, loading, serverWaking, loginDemo } = useAuth();
  return (
    <div>
      <span data-testid="loading">{loading.toString()}</span>
      <span data-testid="serverWaking">{serverWaking.toString()}</span>
      <span data-testid="user">{user ? user.email : "null"}</span>
      <button onClick={() => loginDemo().catch(() => {})}>Try demo</button>
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
    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    mockFetch.mockClear();
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

  it("keeps serverWaking true until overlapping health checks finish", async () => {
    let resolveMountHealth;
    let resolveDemoHealth;
    mockFetch.mockImplementationOnce(() => new Promise((resolve) => {
      resolveMountHealth = resolve;
    }));

    renderWithAuth();
    expect(screen.getByTestId("serverWaking").textContent).toBe("true");

    mockFetch.mockImplementationOnce(() => new Promise((resolve) => {
      resolveDemoHealth = resolve;
    }));
    fireEvent.click(screen.getByText("Try demo"));

    await act(async () => {
      resolveMountHealth({ ok: false });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId("serverWaking").textContent).toBe("true");
    });

    resolveDemoHealth({ ok: false });

    await waitFor(() => {
      expect(screen.getByTestId("serverWaking").textContent).toBe("false");
    });
  });

  it("starts demo login directly without a separate health request", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    renderWithAuth();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/health");
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        accessToken: "demo-token",
        user: { email: "demo-user@example.com", isDemo: true }
      })
    });

    const callsBeforeDemo = mockFetch.mock.calls.length;
    fireEvent.click(screen.getByText("Try demo"));

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("demo-user@example.com");
    });

    const demoCalls = mockFetch.mock.calls
      .slice(callsBeforeDemo)
      .map(([url]) => url);
    expect(demoCalls).toEqual(["/api/auth/demo"]);
  });
});
