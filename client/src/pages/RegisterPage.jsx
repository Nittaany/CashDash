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
    <div className="min-h-[80vh] flex items-center justify-center py-8">
      <div className="card w-full max-w-md">
        <div className="text-center mb-8">
          <Wallet className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-100">Create Account</h1>
          <p className="text-slate-400 mt-2">Start tracking your expenses today</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-900/50 border border-rose-700 rounded-lg text-rose-200 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Name *</label>
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
            <label className="block text-sm font-medium text-slate-300 mb-1">Email *</label>
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
            <label className="block text-sm font-medium text-slate-300 mb-1">Password *</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Min 8 chars, 1 letter, 1 number"
              required
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Phone (optional)</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+977 98XXXXXXXX"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Payment Handle (optional)
            </label>
            <input
              type="text"
              name="paymentHandle"
              value={formData.paymentHandle}
              onChange={handleChange}
              placeholder="UPI ID, eSewa, Fonepay"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Currency</label>
            <select
              name="currency"
              value={formData.currency}
              onChange={handleChange}
              className="w-full"
            >
              <option value="NPR">NPR - Nepali Rupee</option>
              <option value="INR">INR - Indian Rupee</option>
              <option value="USD">USD - US Dollar</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Account
          </button>
        </form>

        <p className="text-center text-slate-400 text-sm mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-emerald-500 hover:text-emerald-400">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
