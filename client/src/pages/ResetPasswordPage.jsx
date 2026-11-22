import { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid reset link. Please request a new password reset.");
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError("Password must contain at least one letter and one number");
      return;
    }

    setLoading(true);

    try {
      await api.post("/api/auth/reset-password", { token, newPassword });
      setSuccess(true);
      setTimeout(() => {
        navigate("/login", { state: { message: "Password reset successfully. Please log in with your new password." } });
      }, 2000);
    } catch (err) {
      setError(err.message || "Failed to reset password. The link may be expired or invalid.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-md mx-auto mt-16">
        <div className="bg-slate-800 rounded-lg p-8 text-center">
          <div className="text-emerald-400 text-5xl mb-4">✓</div>
          <h1 className="text-2xl font-bold text-white mb-4">Password Reset!</h1>
          <p className="text-slate-300 mb-6">
            Your password has been reset successfully. Redirecting to login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-16">
      <div className="bg-slate-800 rounded-lg p-8">
        <h1 className="text-2xl font-bold text-white mb-2">Reset Password</h1>
        <p className="text-slate-400 mb-6">
          Enter your new password below.
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {!token ? (
          <div className="text-center">
            <Link
              to="/forgot-password"
              className="inline-block px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
            >
              Request New Reset Link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-slate-300 mb-1">
                New Password
              </label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Min. 8 characters with letter and number"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Re-enter your new password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-slate-400">
          Remember your password?{" "}
          <Link to="/login" className="text-emerald-400 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
