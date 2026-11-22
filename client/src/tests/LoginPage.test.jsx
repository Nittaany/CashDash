import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { LoginPage } from "../pages/LoginPage.jsx";

// Mock useAuth
const mockLogin = vi.fn();
const mockLoginDemo = vi.fn();
const mockNavigate = vi.fn();

vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: () => ({
    login: mockLogin,
    loginDemo: mockLoginDemo
  })
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

function renderLoginPage() {
  return render(
    <BrowserRouter>
      <LoginPage />
    </BrowserRouter>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders email and password inputs", () => {
    renderLoginPage();

    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
  });

  it("renders Instant Demo button", () => {
    renderLoginPage();

    expect(screen.getByText(/Try Instant Demo/)).toBeInTheDocument();
  });

  it("calls loginDemo when demo button is clicked", async () => {
    mockLoginDemo.mockResolvedValue({ name: "Demo User" });
    renderLoginPage();

    fireEvent.click(screen.getByText(/Try Instant Demo/));

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
    fireEvent.click(screen.getByText("Sign In"));

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
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
    fireEvent.click(screen.getByText("Sign In"));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });
  });
});
