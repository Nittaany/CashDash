import { useState, useEffect, useRef } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { Loader2 } from "lucide-react";

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [status, setStatus] = useState("verifying");
  const [error, setError] = useState("");
  const verificationRequestRef = useRef(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("Invalid verification link. Please request a new one.");
      return;
    }

    setStatus("verifying");
    setError("");

    let active = true;
    let redirectTimeout;
    if (verificationRequestRef.current?.token !== token) {
      verificationRequestRef.current = {
        token,
        promise: api.post("/api/auth/verify-email", { token })
      };
    }

    verificationRequestRef.current.promise
      .then(() => {
        if (!active) return;
        setStatus("success");
        redirectTimeout = window.setTimeout(() => {
          navigate("/login", { state: { message: "Email verified! You can now log in." } });
        }, 2000);
      })
      .catch((err) => {
        if (!active) return;
        setStatus("error");
        setError(err.message || "Verification failed. The link may be expired or invalid.");
      });

    return () => {
      active = false;
      if (redirectTimeout) {
        window.clearTimeout(redirectTimeout);
      }
    };
  }, [token, navigate]);

  if (status === "verifying") {
    return (
      <div className="max-w-md mx-auto mt-16">
        <div className="bg-slate-800 rounded-lg p-8 text-center">
          <Loader2 className="w-12 h-12 text-emerald-400 animate-spin mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Verifying Email</h1>
          <p className="text-slate-400" role="status" aria-live="polite">
            Please wait while we verify your email address...
          </p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="max-w-md mx-auto mt-16">
        <div className="bg-slate-800 rounded-lg p-8 text-center">
          <div className="text-emerald-400 text-5xl mb-4">✓</div>
          <h1 className="text-2xl font-bold text-white mb-4">Email Verified!</h1>
          <p className="text-slate-300 mb-6" role="status" aria-live="polite">
            Your email has been verified successfully. Redirecting to login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-16">
      <div className="bg-slate-800 rounded-lg p-8 text-center">
        <div className="text-red-400 text-5xl mb-4">✕</div>
        <h1 className="text-2xl font-bold text-white mb-4">Verification Failed</h1>
        <p className="text-slate-300 mb-6" role="alert">{error}</p>
        <div className="space-y-3">
          <Link
            to="/login"
            className="block w-full px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
          >
            Go to Login
          </Link>
          <p className="text-slate-400 text-sm">
            Need a new verification link?{" "}
            <Link to="/resend-verification" className="text-emerald-400 hover:underline">
              Resend verification email
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
