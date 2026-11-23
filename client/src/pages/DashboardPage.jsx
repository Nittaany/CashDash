import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api/client.js";
import { formatMoney, toMinorUnits } from "../utils/currency.js";
import {
  Wallet,
  TrendingUp,
  ArrowRight,
  Plus,
  Loader2,
  Receipt,
  Users,
  AlertCircle
} from "lucide-react";

export function DashboardPage() {
  const { user, refreshUser } = useAuth();
  const [walletData, setWalletData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadWalletData();
  }, []);

  const loadWalletData = async () => {
    try {
      const data = await api.get("/api/wallet");
      setWalletData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTopup = async (e) => {
    e.preventDefault();
    setError("");

    const amountMinor = toMinorUnits(topupAmount);
    if (!amountMinor) {
      setError("Please enter a valid amount greater than 0");
      return;
    }

    setTopupLoading(true);
    try {
      const data = await api.post("/api/wallet/topup", { amountMinor });
      setWalletData((prev) => ({ ...prev, walletBalanceMinor: data.walletBalanceMinor }));
      setTopupAmount("");
      await refreshUser();
    } catch (err) {
      setError(err.message);
    } finally {
      setTopupLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    );
  }

  const categoryColors = {
    Food: "bg-orange-500",
    Transport: "bg-blue-500",
    Groceries: "bg-emerald-500",
    Entertainment: "bg-purple-500",
    Bills: "bg-rose-500",
    Health: "bg-cyan-500",
    Shopping: "bg-pink-500",
    Other: "bg-slate-500"
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1>Dashboard</h1>
          <p className="text-slate-500 text-sm">Welcome back, {user?.name}</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Wallet Card — primary, top-highlight via stat-card */}
      <div className="stat-card">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-slate-500 text-sm mb-1">Wallet Balance</p>
            <p className="currency text-3xl font-semibold text-slate-50 tabular-nums tracking-tight">
              {formatMoney(walletData?.walletBalanceMinor || 0, user?.currency)}
            </p>
          </div>
          <div className="p-2.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <Wallet className="w-5 h-5 text-emerald-500" />
          </div>
        </div>

        <form onSubmit={handleTopup} className="flex gap-2">
          <input
            type="text"
            value={topupAmount}
            onChange={(e) => setTopupAmount(e.target.value)}
            placeholder="Amount"
            className="flex-1"
          />
          <button
            type="submit"
            disabled={topupLoading}
            className="btn-primary flex items-center gap-2"
          >
            {topupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add
          </button>
        </form>
      </div>

      {/* Grid */}
      <div className="grid md:grid-cols-2 gap-4 stagger-children">
        {/* Monthly Summary */}
        <div className="card animate-fade-up">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <h2 className="text-base">This Month</h2>
          </div>
          <p className="currency text-2xl font-semibold text-slate-50 mb-4 tracking-tight">
            {formatMoney(walletData?.monthlySummary?.totalSpentMinor || 0, user?.currency)}
          </p>

          {walletData?.monthlySummary?.byCategory && Object.keys(walletData.monthlySummary.byCategory).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(walletData.monthlySummary.byCategory).map(([category, amountMinor]) => {
                const total = walletData.monthlySummary.totalSpentMinor || 1;
                const percent = Math.round((amountMinor / total) * 100);
                return (
                  <div key={category}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-400">{category}</span>
                      <span className="text-slate-500 tabular-nums">{percent}%</span>
                    </div>
                    <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className={`category-bar-fill h-full rounded-full ${categoryColors[category] || categoryColors.Other}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">No expenses this month</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card animate-fade-up">
          <h2 className="text-base mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <Link
              to="/expenses"
              className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-transparent
                         hover:bg-white/[0.04] hover:border-emerald-400/35 hover:-translate-y-0.5
                         active:scale-[0.99]
                         transition-all duration-300 ease-out group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/[0.04] rounded-lg border border-white/[0.06] group-hover:border-emerald-500/20 transition-colors">
                  <Receipt className="w-4 h-4 text-emerald-500" />
                </div>
                <span className="text-slate-200 text-sm">Add Expense</span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
            </Link>
            <Link
              to="/groups"
              className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-transparent
                         hover:bg-white/[0.04] hover:border-emerald-400/35 hover:-translate-y-0.5
                         active:scale-[0.99]
                         transition-all duration-300 ease-out group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/[0.04] rounded-lg border border-white/[0.06] group-hover:border-emerald-500/20 transition-colors">
                  <Users className="w-4 h-4 text-emerald-500" />
                </div>
                <span className="text-slate-200 text-sm">Manage Groups</span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
