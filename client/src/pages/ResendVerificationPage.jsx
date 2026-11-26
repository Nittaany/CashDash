import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../api/client.js";

export function ResendVerificationPage() {
  const location = useLocation();
  const isPendingRegistration = location.state?.registered === true;
  const [email, setEmail] = useState(location.state?.email || "");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.post("/api/auth/resend-verification", { email });
      setSubmitted(true);
    } catch (requestError) {
      setError(requestError.message || "Failed to send verification email");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-md mx-auto mt-16">
        <div className="bg-slate-800 rounded-lg p-8 text-center">
          <div className="text-emerald-400 text-5xl mb-4">✓</div>
          <h1 className="text-2xl font-bold text-white mb-4">Check Your Email</h1>
          <p className="text-slate-300 mb-6">
            If an account exists for <span className="text-white">{email}</span>, we&apos;ll send a verification link when email delivery is available.
          </p>
          <Link
            to="/login"
            className="inline-block px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-16">
      <div className="bg-slate-800 rounded-lg p-8">
        <h1 className="text-2xl font-bold text-white mb-2">Resend Verification Email</h1>
        <p className="text-slate-400 mb-6">
          {isPendingRegistration
            ? `Your account is registered. Check ${email} for the verification link, or request another one below.`
            : "Enter your email address and we'll send a new verification link if your account needs one."}
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="verification-email" className="block text-sm font-medium text-slate-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              id="verification-email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Sending..." : "Resend Verification Email"}
          </button>
        </form>

        <p className="mt-6 text-center text-slate-400">
          Already verified?{" "}
          <Link to="/login" className="text-emerald-400 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
