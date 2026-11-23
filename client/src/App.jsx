import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import { Toast } from "./components/Toast.jsx";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";
import { Navbar } from "./components/Navbar.jsx";
import { Footer } from "./components/Footer.jsx";
import { ServerWakeIndicator } from "./components/ServerWakeIndicator.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { RegisterPage } from "./pages/RegisterPage.jsx";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage.jsx";
import { ResetPasswordPage } from "./pages/ResetPasswordPage.jsx";
import { VerifyEmailPage } from "./pages/VerifyEmailPage.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { ExpensesPage } from "./pages/ExpensesPage.jsx";
import { GroupsPage } from "./pages/GroupsPage.jsx";
import { GroupDetailPage } from "./pages/GroupDetailPage.jsx";
import { ProfilePage } from "./pages/ProfilePage.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { AmbientShaderBackground } from "./components/AmbientShaderBackground.jsx";

function AppRoutes() {
  const { user, loading, serverWaking, demoSessionEnded, clearDemoSessionEnded } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect to login with message when demo session ends
  useEffect(() => {
    if (demoSessionEnded && location.pathname !== "/login") {
      clearDemoSessionEnded();
      navigate("/login", { state: { message: "Demo session ended" } });
    }
  }, [demoSessionEnded, location.pathname, navigate, clearDemoSessionEnded]);

  // Show loading state only when not waking (wake indicator handles that)
  if (loading && !serverWaking) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <div className="text-slate-500 text-sm">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <ServerWakeIndicator
        isWaking={serverWaking}
      />
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />
        <Route path="/forgot-password" element={user ? <Navigate to="/dashboard" replace /> : <ForgotPasswordPage />} />
        <Route path="/reset-password" element={user ? <Navigate to="/dashboard" replace /> : <ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/expenses"
          element={
            <ProtectedRoute>
              <ExpensesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/groups"
          element={
            <ProtectedRoute>
              <GroupsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/groups/:groupId"
          element={
            <ProtectedRoute>
              <GroupDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: "var(--color-canvas)" }}>
        <AmbientShaderBackground />
        <Navbar />
        <main className="container mx-auto px-4 py-6 flex-1 relative z-10">
          <AppRoutes />
        </main>
        <Footer />
        <Toast />
      </div>
    </ErrorBoundary>
  );
}
