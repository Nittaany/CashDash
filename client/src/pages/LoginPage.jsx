import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { getConfiguredOAuthProviders } from "../api/client.js";
import { OAuthButtons } from "../components/OAuthButtons.jsx";
import { getOAuthErrorMessage } from "../utils/oauthMessages.js";
import { Wallet, Loader2, Zap, ArrowRight } from "lucide-react";

export function LoginPage() {
  const { login, loginDemo } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  useEffect(() => {
    if (location.state?.message) {
      setInfo(location.state.message);
      window.history.replaceState({}, document.title);
    }
    const oauthError = new URLSearchParams(location.search).get("oauthError");
    if (oauthError) {
      setError(getOAuthErrorMessage(oauthError));
      setVerificationRequired(false);
    }
  }, [location.state, location.search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setVerificationRequired(false);
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
      setVerificationRequired(/verify your email/i.test(err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setError("");
    setInfo("");
    setDemoLoading(true);
    try {
      await loginDemo();
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 relative">
      {/* Atmospheric radial glow behind auth card */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[500px] aspect-square"
        style={{
          background: "radial-gradient(ellipse at center, rgba(16,185,129,0.07) 0%, rgba(20,184,166,0.03) 40%, transparent 70%)",
          filter: "blur(60px)"
        }}
      />

      <div className="w-full max-w-sm animate-slide-up relative">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
            <Wallet className="w-6 h-6 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-50 mb-2 tracking-tight">CashDash</h1>
          <p className="text-slate-400 text-sm">Track expenses. Split bills. Settle debts.</p>
        </div>

        {/* Alerts */}
        {info && (
          <div className="alert alert-warning mb-4">
            <span>{info}</span>
          </div>
        )}

        {error && (
          <div className="alert alert-error mb-4">
            <span>{error}</span>
            {verificationRequired && (
              <Link
                to="/resend-verification"
                state={{ email }}
                className="mt-2 block text-sm text-emerald-300 hover:text-emerald-200"
              >
                Resend verification email
              </Link>
            )}
          </div>
        )}

        {/* Auth Card */}
        <div className="relative rounded-xl border border-white/[0.10] bg-slate-950/55 backdrop-blur-xl p-6 mb-6 shadow-[0_24px_80px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.09)] before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-emerald-300/40 before:to-transparent">
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            <div>
              <label htmlFor="login-email" className="block text-sm text-slate-400 mb-1.5">Email</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm text-slate-400 mb-1.5">Password</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full"
              />
              <div className="mt-1.5 text-right">
                <Link to="/forgot-password" className="text-xs text-slate-500 hover:text-emerald-400">
                  Forgot password?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Sign in
            </button>
          </form>

          <OAuthButtons providers={getConfiguredOAuthProviders()} />

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/[0.06]" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-[#0c1017] text-slate-500 text-xs">or</span>
            </div>
          </div>

          {/* Demo Button — high contrast CTA */}
          <button
            onClick={handleDemo}
            disabled={demoLoading}
            className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-lg
                       bg-emerald-500 text-[#06110d] border border-emerald-300/40 font-semibold shadow-[0_12px_32px_rgba(16,185,129,0.16)]
                       hover:bg-emerald-400 hover:-translate-y-0.5
                       active:bg-emerald-600 active:translate-y-0
                       active:scale-[0.98] transition-all duration-200 ease-out"
          >
            {demoLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            <span>Try Instant Demo (No Signup)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <p className="text-center text-xs text-slate-500 mt-2.5">
            No signup required · 2 hour session
          </p>
        </div>

        {/* Register Link */}
        <p className="text-center text-sm text-slate-500">
          Don't have an account?{" "}
          <Link to="/register" className="text-emerald-400 hover:text-emerald-300">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
