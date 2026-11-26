import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import {
  api,
  getConfiguredOAuthProviders,
  redirectToOAuthAuthorizationUrl
} from "../api/client.js";
import { Loader2, User, AlertCircle } from "lucide-react";
import { getOAuthErrorMessage } from "../utils/oauthMessages.js";

const PROVIDER_LABELS = {
  google: "Google",
  github: "GitHub"
};

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    paymentHandle: user?.paymentHandle || "",
    currency: user?.currency || "NPR"
  });
  const [loading, setLoading] = useState(false);
  const [linkingProvider, setLinkingProvider] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const configuredProviders = getConfiguredOAuthProviders();
  const linkedProviders = new Set(user?.authProviders || []);
  const oauthError = searchParams.get("oauthError");
  const linkedProvider = searchParams.get("oauthLinked");
  const displayedError = error || (oauthError ? getOAuthErrorMessage(oauthError) : "");
  const linkedMessage = PROVIDER_LABELS[linkedProvider]
    ? `${PROVIDER_LABELS[linkedProvider]} account linked successfully.`
    : "";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await api.patch("/api/auth/me", formData);
      await refreshUser();
      setSuccess("Profile updated successfully!");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkProvider = async (provider) => {
    setError("");
    setSuccess("");
    setLinkingProvider(provider);

    try {
      const { authorizationUrl } = await api.post(`/api/auth/oauth/${provider}/link`, {});
      redirectToOAuthAuthorizationUrl(authorizationUrl);
    } catch (requestError) {
      setError(requestError.message || "Unable to start provider linking");
    } finally {
      setLinkingProvider("");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-up">
      <h1>Profile</h1>

      {user?.isDemo && (
        <div className="alert alert-warning">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div>
            <p className="text-amber-200 font-medium">Demo Account</p>
            <p className="text-amber-300/80 text-sm">Profile editing is disabled for demo users. Sign up to access all features!</p>
          </div>
        </div>
      )}

      {displayedError && (
        <div className="alert alert-error">
          <span>{displayedError}</span>
        </div>
      )}

      {(success || linkedMessage) && (
        <div className="alert alert-success">
          <span>{success || linkedMessage}</span>
        </div>
      )}

      <div className="card border-white/[0.10]">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-4 bg-white/[0.04] rounded-full border border-white/[0.06]">
            <User className="w-8 h-8 text-emerald-500" />
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-100">{user?.name}</p>
            <p className="text-slate-400">{user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              disabled={user?.isDemo}
              className="w-full disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
              placeholder="+977 98XXXXXXXX"
              disabled={user?.isDemo}
              className="w-full disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Payment Handle (UPI / eSewa / Fonepay)
            </label>
            <input
              type="text"
              value={formData.paymentHandle}
              onChange={(e) => setFormData((p) => ({ ...p, paymentHandle: e.target.value }))}
              placeholder="your@upi or 98XXXXXXXX"
              disabled={user?.isDemo}
              className="w-full disabled:opacity-50"
            />
            <p className="text-slate-500 text-sm mt-1">
              This will be shown to group members when they need to pay you
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Currency</label>
            <select
              value={formData.currency}
              onChange={(e) => setFormData((p) => ({ ...p, currency: e.target.value }))}
              disabled={user?.isDemo}
              className="w-full disabled:opacity-50"
            >
              <option value="NPR">NPR - Nepali Rupee</option>
              <option value="INR">INR - Indian Rupee</option>
              <option value="USD">USD - US Dollar</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading || user?.isDemo}
            className="btn-primary flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </form>
      </div>

      {configuredProviders.length > 0 && (
        <div className="card border-white/[0.10]">
          <h2 className="text-lg font-semibold text-slate-100 mb-2">Connected accounts</h2>
          <p className="text-sm text-slate-400 mb-4">
            Link a provider only while signed in. Matching email addresses never link accounts automatically.
          </p>
          <div className="space-y-3">
            {configuredProviders.map((provider) => {
              const isLinked = linkedProviders.has(provider);
              const isLinking = linkingProvider === provider;
              return (
                <div key={provider} className="flex items-center justify-between gap-4">
                  <span className="text-slate-200">{PROVIDER_LABELS[provider]}</span>
                  {isLinked ? (
                    <span className="text-sm text-emerald-400">{PROVIDER_LABELS[provider]} linked</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleLinkProvider(provider)}
                      disabled={Boolean(linkingProvider) || user?.isDemo}
                      className="btn-secondary text-sm disabled:opacity-50"
                    >
                      {isLinking && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}
                      {isLinking ? "Linking..." : `Link ${PROVIDER_LABELS[provider]}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {user?.isDemo && (
            <p className="mt-4 text-sm text-slate-400">
              Sign up for a CashDash account before linking a provider.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
