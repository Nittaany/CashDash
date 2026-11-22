import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api/client.js";
import { Loader2, User, AlertCircle } from "lucide-react";

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [formData, setFormData] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    paymentHandle: user?.paymentHandle || "",
    currency: user?.currency || "NPR"
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">Profile</h1>

      {user?.isDemo && (
        <div className="flex items-center gap-3 p-4 bg-amber-900/30 border border-amber-700 rounded-lg">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div>
            <p className="text-amber-200 font-medium">Demo Account</p>
            <p className="text-amber-300/80 text-sm">Profile editing is disabled for demo users. Sign up to access all features!</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-900/50 border border-rose-700 rounded-lg text-rose-200">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-900/50 border border-emerald-700 rounded-lg text-emerald-200">
          {success}
        </div>
      )}

      <div className="card">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-4 bg-slate-800 rounded-full">
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
    </div>
  );
}
