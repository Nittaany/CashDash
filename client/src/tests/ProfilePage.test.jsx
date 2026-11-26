import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { ProfilePage } from "../pages/ProfilePage.jsx";

const {
  mockRefreshUser,
  mockApiPost,
  mockRedirectToOAuth,
  mockOAuthProviders,
  mockUser
} = vi.hoisted(() => ({
  mockRefreshUser: vi.fn(),
  mockApiPost: vi.fn(),
  mockRedirectToOAuth: vi.fn(),
  mockOAuthProviders: [],
  mockUser: {
    name: "Profile User",
    email: "profile@example.com",
    authProviders: ["google"]
  }
}));

vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: () => ({ user: mockUser, refreshUser: mockRefreshUser })
}));

vi.mock("../api/client.js", () => ({
  api: {
    patch: vi.fn(),
    post: mockApiPost
  },
  getConfiguredOAuthProviders: () => mockOAuthProviders,
  redirectToOAuthAuthorizationUrl: mockRedirectToOAuth
}));

function renderProfilePage() {
  return render(
    <BrowserRouter>
      <ProfilePage />
    </BrowserRouter>
  );
}

describe("ProfilePage provider linking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOAuthProviders.length = 0;
    mockOAuthProviders.push("google", "github");
    mockUser.authProviders = ["google"];
    mockUser.isDemo = false;
  });

  it("shows linked identities and lets the signed-in user start explicit linking", async () => {
    let resolveLink;
    mockApiPost.mockImplementation(() => new Promise((resolve) => {
      resolveLink = resolve;
    }));
    renderProfilePage();

    expect(screen.getByText("Google linked")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Link GitHub" }));
    expect(screen.getByRole("button", { name: "Linking..." })).toBeDisabled();

    await act(async () => {
      resolveLink({
        authorizationUrl: "https://github.com/login/oauth/authorize?state=signed"
      });
    });

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith("/api/auth/oauth/github/link", {});
      expect(mockRedirectToOAuth).toHaveBeenCalledWith(
        "https://github.com/login/oauth/authorize?state=signed"
      );
    });
  });

  it("disables provider linking for demo users", () => {
    mockUser.isDemo = true;
    renderProfilePage();

    expect(screen.getByRole("button", { name: "Link GitHub" })).toBeDisabled();
  });

  it("shows a clear error if provider linking cannot start", async () => {
    mockApiPost.mockRejectedValue(new Error("OAuth provider is not available"));
    renderProfilePage();

    fireEvent.click(screen.getByRole("button", { name: "Link GitHub" }));

    expect(await screen.findByText("OAuth provider is not available")).toBeInTheDocument();
  });
});
