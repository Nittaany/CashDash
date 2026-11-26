import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const { mockApiPost } = vi.hoisted(() => ({
  mockApiPost: vi.fn()
}));

vi.mock("../api/client.js", () => ({
  api: { post: mockApiPost }
}));

describe("ResendVerificationPage", () => {
  it("resends to the supplied email and shows an account-neutral confirmation", async () => {
    const pageModule = await import("../pages/ResendVerificationPage.jsx").catch(() => null);
    expect(pageModule).toHaveProperty("ResendVerificationPage");
    if (!pageModule) return;

    mockApiPost.mockResolvedValue({});
    const { ResendVerificationPage } = pageModule;
    render(
      <MemoryRouter
        initialEntries={[{
          pathname: "/resend-verification",
          state: { email: "pending@example.com" }
        }]}
      >
        <Routes>
          <Route path="/resend-verification" element={<ResendVerificationPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /resend verification email/i }));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith("/api/auth/resend-verification", {
        email: "pending@example.com"
      });
    });
    expect(await screen.findByText(/if an account exists/i)).toBeInTheDocument();
  });
});
