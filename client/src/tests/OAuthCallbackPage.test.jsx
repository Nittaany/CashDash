import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { OAuthCallbackPage } from "../pages/OAuthCallbackPage.jsx";

const { mockRestoreOAuthSession, mockNavigate } = vi.hoisted(() => ({
  mockRestoreOAuthSession: vi.fn(),
  mockNavigate: vi.fn()
}));

vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: () => ({ restoreOAuthSession: mockRestoreOAuthSession })
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

describe("OAuthCallbackPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restores the CashDash session before opening the dashboard", async () => {
    mockRestoreOAuthSession.mockResolvedValue({ email: "oauth@example.com" });
    render(
      <StrictMode>
        <BrowserRouter>
          <OAuthCallbackPage />
        </BrowserRouter>
      </StrictMode>
    );

    expect(screen.getByText("Completing sign-in")).toBeInTheDocument();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
    });
    expect(mockRestoreOAuthSession).toHaveBeenCalledOnce();
  });

  it("returns to login with a safe message if session restoration fails", async () => {
    mockRestoreOAuthSession.mockRejectedValue(new Error("Internal token detail"));
    render(
      <StrictMode>
        <BrowserRouter>
          <OAuthCallbackPage />
        </BrowserRouter>
      </StrictMode>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login", {
        replace: true,
        state: { message: "We couldn't complete provider sign-in. Please try again." }
      });
    });
    expect(mockRestoreOAuthSession).toHaveBeenCalledOnce();
  });
});
