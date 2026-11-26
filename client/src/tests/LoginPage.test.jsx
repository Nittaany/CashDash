import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { LoginPage } from "../pages/LoginPage.jsx";

// Mock useAuth
const { mockLogin, mockLoginDemo, mockNavigate, mockApiGet, mockOAuthProviders } = vi.hoisted(() => ({
  mockLogin: vi.fn(),
  mockLoginDemo: vi.fn(),
  mockNavigate: vi.fn(),
  mockApiGet: vi.fn(),
  mockOAuthProviders: []
}));

vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: () => ({
    login: mockLogin,
    loginDemo: mockLoginDemo
  })
}));

vi.mock("../api/client.js", () => ({
  api: {
    get: mockApiGet
  },
  getConfiguredOAuthProviders: () => mockOAuthProviders
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

function renderLoginPage(path = "/login") {
  window.history.replaceState({}, "", path);
  return render(
    <BrowserRouter>
      <LoginPage />
    </BrowserRouter>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOAuthProviders.length = 0;
  });

  it("does not run an independent health check", () => {
    renderLoginPage();

    expect(mockApiGet).not.toHaveBeenCalledWith("/api/health");
  });

  it("renders email and password inputs", () => {
    renderLoginPage();

    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
  });

  it("renders Instant Demo button", () => {
    renderLoginPage();

    expect(screen.getByText(/instant demo/i)).toBeInTheDocument();
  });

  it("shows only configured provider sign-in buttons", () => {
    mockOAuthProviders.push("google");
    renderLoginPage();

    expect(screen.getByRole("link", { name: "Continue with Google" }))
      .toHaveAttribute("href", "/api/auth/oauth/google");
    expect(screen.queryByRole("link", { name: "Continue with GitHub" })).not.toBeInTheDocument();
  });

  it("shows a safe message for OAuth callback errors", () => {
    renderLoginPage("/login?oauthError=account_exists_sign_in");

    expect(screen.getByText(/sign in first, then link the provider/i)).toBeInTheDocument();
    expect(screen.queryByText(/account_exists_sign_in/i)).not.toBeInTheDocument();
  });

  it("calls loginDemo when demo button is clicked", async () => {
    mockLoginDemo.mockResolvedValue({ name: "Demo User" });
    renderLoginPage();

    fireEvent.click(screen.getByText(/instant demo/i));

    await waitFor(() => {
      expect(mockLoginDemo).toHaveBeenCalled();
    });
  });

  it("displays error message on failed login", async () => {
    mockLogin.mockRejectedValue(new Error("Invalid credentials"));
    renderLoginPage();

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "test@example.com" }
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "wrongpassword" }
    });
    fireEvent.click(screen.getByText(/sign in/i));

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });

  it("offers a resend-verification path after an unverified login is rejected", async () => {
    mockLogin.mockRejectedValue(new Error("Please verify your email before logging in"));
    renderLoginPage();

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "pending@example.com" }
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "Password123" }
    });
    fireEvent.click(screen.getByText(/sign in/i));

    const resendLink = await screen.findByRole("link", { name: /resend verification email/i });
    expect(resendLink).toHaveAttribute("href", "/resend-verification");
    fireEvent.click(resendLink);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/resend-verification");
      expect(window.history.state.usr).toEqual({ email: "pending@example.com" });
    });
  });

  it("navigates to dashboard on successful login", async () => {
    mockLogin.mockResolvedValue({ name: "Test User" });
    renderLoginPage();

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "test@example.com" }
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "password123" }
    });
    fireEvent.click(screen.getByText(/sign in/i));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });
  });
});
