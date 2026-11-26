import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

export function OAuthCallbackPage() {
  const { restoreOAuthSession } = useAuth();
  const navigate = useNavigate();
  const restorePromiseRef = useRef(null);

  useEffect(() => {
    let active = true;
    if (!restorePromiseRef.current) {
      restorePromiseRef.current = restoreOAuthSession();
    }

    restorePromiseRef.current
      .then(() => {
        if (active) navigate("/dashboard", { replace: true });
      })
      .catch(() => {
        if (active) {
          navigate("/login", {
            replace: true,
            state: { message: "We couldn't complete provider sign-in. Please try again." }
          });
        }
      });

    return () => {
      active = false;
    };
  }, [navigate, restoreOAuthSession]);

  return (
    <div className="max-w-md mx-auto mt-16">
      <div className="bg-slate-800 rounded-lg p-8 text-center">
        <Loader2 className="w-12 h-12 text-emerald-400 animate-spin mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Completing sign-in</h1>
        <p className="text-slate-400">Connecting your CashDash account...</p>
      </div>
    </div>
  );
}
