import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "../context/AuthContext.jsx";
import App from "../App.jsx";
import { clearAccessToken, getAccessToken } from "../api/client.js";

vi.mock("../components/AmbientShaderBackground.jsx", () => ({
  AmbientShaderBackground: () => null
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

function TestConsumer() {
  const navigate = useNavigate();
  const { user, loading, serverWaking, loginDemo, register, restoreOAuthSession } = useAuth();
  return (
    <div>
      <span data-testid="loading">{loading.toString()}</span>
      <span data-testid="serverWaking">{serverWaking.toString()}</span>
      <span data-testid="user">{user ? user.email : "null"}</span>
      <span data-testid="accessToken">{getAccessToken() ?? "null"}</span>
      <button onClick={() => loginDemo().catch(() => {})}>Try demo</button>
      <button onClick={() => register({
        name: "Pending User",
        email: "pending@example.com",
        password: "Password123"
      }).catch(() => {})}>Register pending</button>
      <button onClick={() => restoreOAuthSession().catch(() => {})}>Restore OAuth</button>
      <button onClick={() => navigate("/dashboard")}>Open protected</button>
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
    mockFetch.mockReset();
    clearAccessToken();
  });

  afterEach(() => {
    cleanup();
    clearAccessToken();
    vi.restoreAllMocks();
    window.history.replaceState({}, "", "/");
  });

  it("restores a protected-route session without a health preflight", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ accessToken: "restored-token" })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: { email: "test@example.com" } })
      });

    renderWithAuth();

    await waitFor(() => {
      expect(mockFetch.mock.calls.map(([url]) => url)).toEqual([
        "/api/auth/refresh",
        "/api/auth/me"
      ]);
    });
    expect(screen.getByTestId("user").textContent).toBe("test@example.com");
    expect(screen.getByTestId("loading").textContent).toBe("false");
  });

  it("sets serverWaking true during session restoration", async () => {
    let resolveRefresh;
    mockFetch.mockImplementationOnce(() => new Promise((resolve) => {
      resolveRefresh = resolve;
    }));

    renderWithAuth();
    expect(screen.getByTestId("serverWaking").textContent).toBe("true");

    resolveRefresh({
      ok: false,
      json: () => Promise.resolve({ error: "No refresh token" })
    });

    await waitFor(() => {
      expect(screen.getByTestId("serverWaking").textContent).toBe("false");
    });
  });

  it("restores the user after a successful refresh", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ accessToken: "test-token" })
    }).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: { email: "test@example.com" } })
    });

    renderWithAuth();

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("test@example.com");
    });
  });

  it("handles a missing refresh session gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "No refresh token" })
    });

    renderWithAuth();

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
      expect(screen.getByTestId("user").textContent).toBe("null");
    });
  });

  it("keeps serverWaking true until overlapping restore and demo requests finish", async () => {
    let resolveMountRefresh;
    let resolveDemo;
    mockFetch.mockImplementationOnce(() => new Promise((resolve) => {
      resolveMountRefresh = resolve;
    }));

    renderWithAuth();
    expect(screen.getByTestId("serverWaking").textContent).toBe("true");

    mockFetch.mockImplementationOnce(() => new Promise((resolve) => {
      resolveDemo = resolve;
    }));
    fireEvent.click(screen.getByText("Try demo"));

    await act(async () => {
      resolveMountRefresh({
        ok: false,
        json: () => Promise.resolve({ error: "No refresh token" })
      });
      await Promise.resolve();
    });

    expect(screen.getByTestId("serverWaking").textContent).toBe("true");

    resolveDemo({
      ok: false,
      json: () => Promise.resolve({ error: "Demo failed" })
    });

    await waitFor(() => {
      expect(screen.getByTestId("serverWaking").textContent).toBe("false");
    });
  });

  it("does not make a backend request before demo login on the public auth route", () => {
    window.history.replaceState({}, "", "/login");
    mockFetch.mockImplementation(() => new Promise(() => {}));

    render(
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    );

    expect(screen.getByRole("button", { name: /Try Instant Demo/ })).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("restores a session only after navigating from a public auth route to a protected route", async () => {
    window.history.replaceState({}, "", "/login");
    renderWithAuth();
    expect(mockFetch).not.toHaveBeenCalled();

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ accessToken: "restored-after-login-token" })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: { email: "restored-after-login@example.com" } })
      });
    fireEvent.click(screen.getByText("Open protected"));

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("restored-after-login@example.com");
    });
    expect(mockFetch.mock.calls.map(([url]) => url)).toEqual([
      "/api/auth/refresh",
      "/api/auth/me"
    ]);
  });

  it("does not let a late session restore overwrite a completed demo login", async () => {
    let resolveStartup;
    mockFetch.mockImplementationOnce(() => new Promise((resolve) => {
      resolveStartup = resolve;
    }));

    renderWithAuth();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        accessToken: "demo-token",
        user: { email: "demo-user@example.com", isDemo: true }
      })
    });
    fireEvent.click(screen.getByText("Try demo"));

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("demo-user@example.com");
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ accessToken: "restore-token" })
    }).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: { email: "restored-user@example.com" } })
    });

    await act(async () => {
      resolveStartup({
        ok: true,
        json: () => Promise.resolve({ accessToken: "restore-token" })
      });
    });

    expect(screen.getByTestId("user").textContent).toBe("demo-user@example.com");
  });

  it("does not create a client session for registration awaiting email verification", async () => {
    window.history.replaceState({}, "", "/register");
    renderWithAuth();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        requiresEmailVerification: true,
        user: { email: "pending@example.com", isEmailVerified: false }
      })
    });
    fireEvent.click(screen.getByText("Register pending"));

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("null");
    });
    expect(screen.getByTestId("accessToken").textContent).toBe("null");
  });

  it("restores the existing CashDash session after an OAuth callback", async () => {
    window.history.replaceState({}, "", "/oauth/callback");
    renderWithAuth();

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ accessToken: "oauth-access-token" })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: { email: "oauth@example.com" } })
      });
    fireEvent.click(screen.getByText("Restore OAuth"));

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("oauth@example.com");
    });
    expect(screen.getByTestId("accessToken").textContent).toBe("oauth-access-token");
    expect(mockFetch.mock.calls.map(([url]) => url)).toEqual([
      "/api/auth/refresh",
      "/api/auth/me"
    ]);
  });
});
