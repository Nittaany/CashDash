import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ResendVerificationPage } from "../pages/ResendVerificationPage.jsx";

const { mockApiPost } = vi.hoisted(() => ({
  mockApiPost: vi.fn()
}));

vi.mock("../api/client.js", () => ({
  api: { post: mockApiPost }
}));

function renderResendPage(state = {}) {
  return render(
    <MemoryRouter
      initialEntries={[{
        pathname: "/resend-verification",
        state
      }]}
    >
      <Routes>
        <Route path="/resend-verification" element={<ResendVerificationPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ResendVerificationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not claim an account was created when opened after signup", () => {
    renderResendPage({ email: "pending@example.com", registered: true });

    expect(screen.getByText(/if an account needs verification/i)).toBeInTheDocument();
    expect(screen.queryByText(/your account is registered/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toHaveValue("pending@example.com");
  });

  it("resends to the supplied email and gives truthful account-neutral guidance", async () => {
    mockApiPost.mockResolvedValue({});
    renderResendPage({ email: "pending@example.com" });

    fireEvent.click(screen.getByRole("button", { name: /resend verification email/i }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith("/api/auth/resend-verification", {
        email: "pending@example.com"
      });
    });
    expect(await screen.findByRole("heading", { name: /check your email/i })).toBeInTheDocument();
    expect(screen.getByText(/if an account needs verification for this address/i)).toBeInTheDocument();
    expect(screen.getByText(/the address may not be on file or email delivery may be temporarily unavailable/i))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: /request another verification link/i })).toBeInTheDocument();
    expect(screen.queryByText(/your account is registered/i)).not.toBeInTheDocument();
  });

  it("lets the user return to the resend form after the account-neutral response", async () => {
    mockApiPost.mockResolvedValue({});
    renderResendPage({ email: "pending@example.com" });
    fireEvent.click(screen.getByRole("button", { name: /resend verification email/i }));

    const requestAgain = await screen.findByRole("button", {
      name: /request another verification link/i
    });
    fireEvent.click(requestAgain);

    expect(screen.getByRole("button", { name: /resend verification email/i })).toBeInTheDocument();
  });
});
