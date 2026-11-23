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
  Users
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
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  const categoryColors = {
    Food: "bg-orange-500",
    Transport: "bg-blue-500",
    Groceries: "bg-green-500",
    Entertainment: "bg-purple-500",
    Bills: "bg-red-500",
    Other: "bg-slate-500"
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
        <span className="text-slate-400 text-sm">Welcome back, {user?.name}</span>
      </div>

      {error && (
        <div className="p-3 bg-rose-900/50 border border-rose-700 rounded-lg text-rose-200 flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {/* Wallet Card */}
      <div className="card bg-gradient-to-br from-emerald-900/50 to-slate-900">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-emerald-600/20 rounded-xl">
            <Wallet className="w-8 h-8 text-emerald-500" />
          </div>
          <div>
            <p className="text-slate-400 text-sm">Wallet Balance</p>
            <p className="text-3xl font-bold text-slate-100">
              {formatMoney(walletData?.walletBalanceMinor || 0, user?.currency)}
            </p>
          </div>
        </div>

        <form onSubmit={handleTopup} className="flex gap-2">
          <input
            type="text"
            value={topupAmount}
            onChange={(e) => setTopupAmount(e.target.value)}
            placeholder="Amount to add"
            className="flex-1"
          />
          <button
            type="submit"
            disabled={topupLoading}
            className="btn-primary flex items-center gap-2"
          >
            {topupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Top Up
          </button>
        </form>
      </div>

      {/* Monthly Summary */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            <h2 className="text-lg font-semibold text-slate-100">This Month</h2>
          </div>
          <p className="text-2xl font-bold text-slate-100 mb-4">
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
                      <span className="text-slate-300">{category}</span>
                      <span className="text-slate-400">{percent}%</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${categoryColors[category] || categoryColors.Other}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">No expenses this month yet</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link
              to="/expenses"
              className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg hover:bg-slate-800 
                         hover:translate-x-1 transition-all duration-200 group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                  <Receipt className="w-5 h-5 text-emerald-500" />
                </div>
                <span className="text-slate-100">Add Expense</span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 transition-colors" />
            </Link>
            <Link
              to="/groups"
              className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg hover:bg-slate-800 
                         hover:translate-x-1 transition-all duration-200 group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                  <Users className="w-5 h-5 text-emerald-500" />
                </div>
                <span className="text-slate-100">Manage Groups</span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 transition-colors" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
