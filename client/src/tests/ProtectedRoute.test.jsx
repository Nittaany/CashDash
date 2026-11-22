import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "../components/ProtectedRoute.jsx";

// Mock the useAuth hook
vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: vi.fn()
}));

import { useAuth } from "../context/AuthContext.jsx";

function TestComponent() {
  return <div>Protected Content</div>;
}

function LoginPage() {
  return <div>Login Page</div>;
}

describe("ProtectedRoute", () => {
  it("renders loading spinner when loading is true", () => {
    useAuth.mockReturnValue({ user: null, loading: true });

    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <TestComponent />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
  });

  it("redirects to login when not authenticated", () => {
    useAuth.mockReturnValue({ user: null, loading: false });

    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <TestComponent />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("renders protected content when authenticated", () => {
    useAuth.mockReturnValue({
      user: { id: "1", name: "Test User", email: "test@example.com" },
      loading: false
    });

    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <TestComponent />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
    expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
  });
});
