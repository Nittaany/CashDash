import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Wallet, Loader2 } from "lucide-react";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    paymentHandle: "",
    currency: "NPR"
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (!/[a-zA-Z]/.test(formData.password) || !/[0-9]/.test(formData.password)) {
      setError("Password must contain at least one letter and one number");
      return;
    }

    setLoading(true);

    try {
      const data = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        currency: formData.currency
      };
      if (formData.phone) data.phone = formData.phone;
      if (formData.paymentHandle) data.paymentHandle = formData.paymentHandle;

      await register(data);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm animate-slide-up relative before:pointer-events-none before:absolute before:inset-[-40px] before:-z-10 before:rounded-[32px] before:bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.08),transparent_70%)]">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 mb-4">
            <Wallet className="w-6 h-6 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-50 mb-2">Create account</h1>
          <p className="text-slate-400 text-sm">Start tracking your expenses</p>
        </div>

        {error && (
          <div className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Your name"
              required
              minLength={2}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Min 8 chars, letter + number"
              required
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Phone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Optional"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Currency</label>
              <select
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                className="w-full"
              >
                <option value="NPR">NPR</option>
                <option value="INR">INR</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Payment Handle</label>
            <input
              type="text"
              name="paymentHandle"
              value={formData.paymentHandle}
              onChange={handleChange}
              placeholder="UPI ID, eSewa (optional)"
              className="w-full"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Create account
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-8">
          Already have an account?{" "}
          <Link to="/login" className="text-emerald-400 hover:text-emerald-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
