import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api/client.js";
import { Wallet, Loader2, Zap } from "lucide-react";

export function LoginPage() {
  const { login, loginDemo } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [mailConfigured, setMailConfigured] = useState(false);

  // Check if mail is configured on mount
  useEffect(() => {
    api.get("/api/health")
      .then((data) => setMailConfigured(data.mailConfigured === true))
      .catch(() => setMailConfigured(false));
  }, []);

  // Show message from navigation state (e.g., "Demo session ended")
  useEffect(() => {
    if (location.state?.message) {
      setInfo(location.state.message);
      // Clear the state so it doesn't persist on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
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
    <div className="min-h-[80vh] flex items-center justify-center auth-gradient">
      <div className="card w-full max-w-md animate-scaleIn relative overflow-hidden">
        {/* Subtle glow effect */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="text-center mb-8 relative">
          <div className="inline-flex p-3 bg-emerald-500/10 rounded-2xl mb-4">
            <Wallet className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Welcome to CashDash</h1>
          <p className="text-slate-400 mt-2">Track expenses, split bills, settle debts</p>
        </div>

        {info && (
          <div className="mb-4 p-3 bg-amber-900/50 border border-amber-700 rounded-lg text-amber-200 text-sm">
            {info}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-rose-900/50 border border-rose-700 rounded-lg text-rose-200 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full"
            />
            {mailConfigured && (
              <div className="mt-1 text-right">
                <Link to="/forgot-password" className="text-sm text-emerald-500 hover:text-emerald-400">
                  Forgot password?
                </Link>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Sign In
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-700" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-slate-900 text-slate-400">or</span>
          </div>
        </div>

        <button
          onClick={handleDemo}
          disabled={demoLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium
                     bg-gradient-to-r from-emerald-600/20 to-emerald-500/10 
                     border border-emerald-500/50 text-emerald-300
                     hover:from-emerald-600/30 hover:to-emerald-500/20 hover:border-emerald-400/60
                     hover:shadow-lg hover:shadow-emerald-500/10
                     transition-all duration-300"
        >
          {demoLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Zap className="w-4 h-4" />
          )}
          Try Instant Demo
          <span className="text-emerald-400/70 text-sm">(No Signup)</span>
        </button>

        <p className="text-center text-slate-400 text-sm mt-6">
          Don't have an account?{" "}
          <Link to="/register" className="text-emerald-500 hover:text-emerald-400">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
