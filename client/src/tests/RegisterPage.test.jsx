import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { RegisterPage } from "../pages/RegisterPage.jsx";

// Mock useAuth
const mockRegister = vi.fn();
const mockNavigate = vi.fn();
const mockOAuthProviders = [];

vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: () => ({
    register: mockRegister
  })
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

vi.mock("../api/client.js", () => ({
  getConfiguredOAuthProviders: () => mockOAuthProviders
}));

function renderRegisterPage() {
  return render(
    <BrowserRouter>
      <RegisterPage />
    </BrowserRouter>
  );
}

describe("RegisterPage validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOAuthProviders.length = 0;
    window.history.replaceState({}, "", "/register");
  });

  it("renders all required fields", () => {
    renderRegisterPage();

    expect(screen.getByPlaceholderText(/your name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/you@example.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/min 8 chars/i)).toBeInTheDocument();
  });

  it("shows configured social sign-up options", () => {
    mockOAuthProviders.push("github");
    renderRegisterPage();

    expect(screen.getByRole("link", { name: "Continue with GitHub" }))
      .toHaveAttribute("href", "/api/auth/oauth/github");
    expect(screen.queryByRole("link", { name: "Continue with Google" })).not.toBeInTheDocument();
  });

  it("shows error for short password", async () => {
    renderRegisterPage();

    fireEvent.change(screen.getByPlaceholderText(/your name/i), {
      target: { value: "Test User" }
    });
    fireEvent.change(screen.getByPlaceholderText(/you@example.com/i), {
      target: { value: "test@example.com" }
    });
    fireEvent.change(screen.getByPlaceholderText(/min 8 chars/i), {
      target: { value: "short" }
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    });
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("shows error for password without letter", async () => {
    renderRegisterPage();

    fireEvent.change(screen.getByPlaceholderText(/your name/i), {
      target: { value: "Test User" }
    });
    fireEvent.change(screen.getByPlaceholderText(/you@example.com/i), {
      target: { value: "test@example.com" }
    });
    fireEvent.change(screen.getByPlaceholderText(/min 8 chars/i), {
      target: { value: "12345678" }
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/letter and one number/i)).toBeInTheDocument();
    });
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("shows error for password without number", async () => {
    renderRegisterPage();

    fireEvent.change(screen.getByPlaceholderText(/your name/i), {
      target: { value: "Test User" }
    });
    fireEvent.change(screen.getByPlaceholderText(/you@example.com/i), {
      target: { value: "test@example.com" }
    });
    fireEvent.change(screen.getByPlaceholderText(/min 8 chars/i), {
      target: { value: "abcdefgh" }
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/letter and one number/i)).toBeInTheDocument();
    });
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("calls register with valid data", async () => {
    mockRegister.mockResolvedValue({ name: "Test User" });
    renderRegisterPage();

    fireEvent.change(screen.getByPlaceholderText(/your name/i), {
      target: { value: "Test User" }
    });
    fireEvent.change(screen.getByPlaceholderText(/you@example.com/i), {
      target: { value: "test@example.com" }
    });
    fireEvent.change(screen.getByPlaceholderText(/min 8 chars/i), {
      target: { value: "ValidPass123" }
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(expect.objectContaining({
        name: "Test User",
        email: "test@example.com",
        password: "ValidPass123"
      }));
    });
  });

  it("shows account-neutral verification guidance without creating a client session", async () => {
    mockRegister.mockResolvedValue({ requiresEmailVerification: true });
    renderRegisterPage();

    fireEvent.change(screen.getByPlaceholderText(/your name/i), {
      target: { value: "Test User" }
    });
    fireEvent.change(screen.getByPlaceholderText(/you@example.com/i), {
      target: { value: "test@example.com" }
    });
    fireEvent.change(screen.getByPlaceholderText(/min 8 chars/i), {
      target: { value: "ValidPass123" }
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("heading", { name: /check your email/i })).toBeInTheDocument();
    expect(screen.getByText(/if this address can be used, we.ll send a verification link/i)).toBeInTheDocument();
    expect(screen.getByText(/no account is created until you verify your email/i)).toBeInTheDocument();
    expect(screen.queryByText(/your account is registered/i)).not.toBeInTheDocument();

    const resendLink = screen.getByRole("link", { name: /request another verification link/i });
    expect(resendLink).toHaveAttribute("href", "/resend-verification");
    fireEvent.click(resendLink);

    expect(window.location.pathname).toBe("/resend-verification");
    expect(window.history.state.usr).toEqual({ email: "test@example.com" });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("discloses the signup security cookie and absence of passive fingerprinting", () => {
    renderRegisterPage();

    expect(screen.getByText(/first-party security cookie to limit repeated sign-up and verification requests/i))
      .toBeInTheDocument();
    expect(screen.getByText(/do not use passive browser fingerprinting/i)).toBeInTheDocument();
  });

  it("preserves dashboard navigation when email verification is disabled", async () => {
    mockRegister.mockResolvedValue({ name: "Test User" });
    renderRegisterPage();

    fireEvent.change(screen.getByPlaceholderText(/your name/i), {
      target: { value: "Test User" }
    });
    fireEvent.change(screen.getByPlaceholderText(/you@example.com/i), {
      target: { value: "test@example.com" }
    });
    fireEvent.change(screen.getByPlaceholderText(/min 8 chars/i), {
      target: { value: "ValidPass123" }
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("displays API error on registration failure", async () => {
    mockRegister.mockRejectedValue(new Error("Email already exists"));
    renderRegisterPage();

    fireEvent.change(screen.getByPlaceholderText(/your name/i), {
      target: { value: "Test User" }
    });
    fireEvent.change(screen.getByPlaceholderText(/you@example.com/i), {
      target: { value: "existing@example.com" }
    });
    fireEvent.change(screen.getByPlaceholderText(/min 8 chars/i), {
      target: { value: "ValidPass123" }
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
    });
  });
});
