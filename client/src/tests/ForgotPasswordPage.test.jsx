import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage.jsx";

const { mockApiPost } = vi.hoisted(() => ({
  mockApiPost: vi.fn()
}));

vi.mock("../api/client.js", () => ({
  api: { post: mockApiPost }
}));

function renderForgotPasswordPage() {
  return render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>
  );
}

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("explains that reset email is conditional on an eligible password account", () => {
    renderForgotPasswordPage();

    expect(screen.getByText(/if this address belongs to an eligible password account/i)).toBeInTheDocument();
    expect(screen.getByText(/when email delivery is available/i)).toBeInTheDocument();
  });

  it("keeps the confirmation account-neutral and explains why no email may arrive", async () => {
    mockApiPost.mockResolvedValue({});
    renderForgotPasswordPage();
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "unknown@example.com" }
    });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith("/api/auth/forgot-password", {
        email: "unknown@example.com"
      });
    });
    expect(await screen.findByRole("heading", { name: /check your email/i })).toBeInTheDocument();
    expect(screen.getByText(/if an eligible password account exists for this address/i)).toBeInTheDocument();
    expect(screen.getByText(/the address may not be on file or email delivery may be temporarily unavailable/i))
      .toBeInTheDocument();
    expect(screen.queryByText(/email has been sent/i)).not.toBeInTheDocument();
  });
});
