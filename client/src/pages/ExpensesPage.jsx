import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api/client.js";
import { formatMoney, toMinorUnits } from "../utils/currency.js";
import { ConfirmModal } from "../components/ConfirmModal.jsx";
import { Loader2, Plus, Trash2, Filter } from "lucide-react";

const PAYMENT_MODES = ["CASH", "BANK", "WALLET", "CARD", "UPI"];
const CATEGORIES = ["Food", "Transport", "Groceries", "Entertainment", "Bills", "Shopping", "Health", "Other"];

const categoryBadgeColors = {
  Food: "bg-orange-500/15 text-orange-300 border-orange-500/20",
  Transport: "bg-blue-500/15 text-blue-300 border-blue-500/20",
  Groceries: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  Entertainment: "bg-purple-500/15 text-purple-300 border-purple-500/20",
  Bills: "bg-rose-500/15 text-rose-300 border-rose-500/20",
  Shopping: "bg-pink-500/15 text-pink-300 border-pink-500/20",
  Health: "bg-cyan-500/15 text-cyan-300 border-cyan-500/20",
  Other: "bg-slate-500/15 text-slate-300 border-slate-500/20"
};

export function ExpensesPage() {
  const { user, refreshUser } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, expenseId: null });

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    amount: "",
    category: "Food",
    paymentMode: "WALLET",
    description: "",
    date: new Date().toISOString().split("T")[0]
  });
  const [submitting, setSubmitting] = useState(false);

  // Filter state
  const [filters, setFilters] = useState({ category: "", paymentMode: "" });

  useEffect(() => {
    loadExpenses();
  }, [filters]);

  const loadExpenses = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.category) params.append("category", filters.category);
      if (filters.paymentMode) params.append("paymentMode", filters.paymentMode);

      const data = await api.get(`/api/expenses?${params}`);
      setExpenses(data.expenses);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const amountMinor = toMinorUnits(formData.amount);
    if (!amountMinor) {
      setError("Please enter a valid amount greater than 0");
      return;
    }

    setSubmitting(true);
    try {
      const { expense } = await api.post("/api/expenses", {
        amountMinor,
        category: formData.category,
        paymentMode: formData.paymentMode,
        description: formData.description,
        date: new Date(formData.date).toISOString()
      });
      setExpenses((prev) => [expense, ...prev]);
      setFormData({
        amount: "",
        category: "Food",
        paymentMode: "WALLET",
        description: "",
        date: new Date().toISOString().split("T")[0]
      });
      setShowForm(false);
      await refreshUser();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    setDeleteModal({ isOpen: true, expenseId: id });
  };

  const confirmDelete = async () => {
    const id = deleteModal.expenseId;
    setDeleteModal({ isOpen: false, expenseId: null });

    try {
      await api.delete(`/api/expenses/${id}`);
      setExpenses((prev) => prev.filter((e) => e._id !== id));
      await refreshUser();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <h1>Personal Expenses</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Expense
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {/* Add Expense Form */}
      {showForm && (
        <div className="card animate-slide-up">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">New Expense</h2>
          <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Amount *</label>
              <input
                type="text"
                value={formData.amount}
                onChange={(e) => setFormData((p) => ({ ...p, amount: e.target.value }))}
                placeholder="0.00"
                required
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                className="w-full"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Payment Mode</label>
              <select
                value={formData.paymentMode}
                onChange={(e) => setFormData((p) => ({ ...p, paymentMode: e.target.value }))}
                className="w-full"
              >
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))}
                className="w-full"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                placeholder="What was this expense for?"
                className="w-full"
              />
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Add Expense
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-400">Filters</span>
        </div>
        <div className="flex flex-wrap gap-4">
          <select
            value={filters.category}
            onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value }))}
            className="min-w-[150px]"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={filters.paymentMode}
            onChange={(e) => setFilters((p) => ({ ...p, paymentMode: e.target.value }))}
            className="min-w-[150px]"
          >
            <option value="">All Payment Modes</option>
            {PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Expenses List */}
      <div className="card">
        {expenses.length === 0 ? (
          <p className="text-slate-400 text-center py-8">No expenses found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-slate-400 text-sm border-b border-white/[0.08]">
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Category</th>
                  <th className="pb-3 font-medium">Description</th>
                  <th className="pb-3 font-medium">Mode</th>
                  <th className="pb-3 font-medium text-right">Amount</th>
                  <th className="pb-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr
                    key={expense._id}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3 text-slate-300 text-sm">
                      {new Date(expense.date).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${categoryBadgeColors[expense.category] || categoryBadgeColors.Other}`}>
                        {expense.category}
                      </span>
                    </td>
                    <td className="py-3 text-slate-300 text-sm">{expense.description || "—"}</td>
                    <td className="py-3 text-slate-500 text-xs font-medium uppercase tracking-wide">{expense.paymentMode}</td>
                    <td className="py-3 text-right font-semibold text-slate-100 tabular-nums currency">
                      {formatMoney(expense.amountMinor, user?.currency)}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleDelete(expense._id)}
                        className="p-2 text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="Delete Expense"
        message="Delete this expense? The amount will be refunded to your wallet."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, expenseId: null })}
        confirmText="Delete"
      />
    </div>
  );
}
