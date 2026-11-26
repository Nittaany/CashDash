import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { VerifyEmailPage } from "../pages/VerifyEmailPage.jsx";

const { mockApiPost } = vi.hoisted(() => ({
  mockApiPost: vi.fn()
}));

vi.mock("../api/client.js", () => ({
  api: { post: mockApiPost }
}));

function LoginDestination() {
  const location = useLocation();
  return <div>Login destination {location.state?.message}</div>;
}

function renderVerificationPage({ token = "verification-token", strictMode = false } = {}) {
  const routes = (
    <MemoryRouter initialEntries={[`/verify-email?token=${token}`]}>
      <Routes>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/login" element={<LoginDestination />} />
      </Routes>
    </MemoryRouter>
  );

  return render(strictMode ? <StrictMode>{routes}</StrictMode> : routes);
}

describe("VerifyEmailPage", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("verifies once in StrictMode and redirects to login after success", async () => {
    vi.useFakeTimers();
    mockApiPost.mockResolvedValue({});
    renderVerificationPage({ strictMode: true });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockApiPost).toHaveBeenCalledTimes(1);
    expect(mockApiPost).toHaveBeenCalledWith("/api/auth/verify-email", {
      token: "verification-token"
    });
    expect(screen.getByRole("heading", { name: /email verified/i })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(screen.getByText(/login destination email verified/i)).toBeInTheDocument();
  });

  it("offers the existing resend path for an invalid or expired token", async () => {
    mockApiPost.mockRejectedValue(new Error("Invalid or expired verification token"));
    renderVerificationPage();

    expect(await screen.findByRole("heading", { name: /verification failed/i })).toBeInTheDocument();
    expect(screen.getByText(/invalid or expired verification token/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /resend verification email/i }))
      .toHaveAttribute("href", "/resend-verification");
  });
});
