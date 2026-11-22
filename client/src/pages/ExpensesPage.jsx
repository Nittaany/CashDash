import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api/client.js";
import { formatMoney, toMinorUnits } from "../utils/currency.js";
import { ConfirmModal } from "../components/ConfirmModal.jsx";
import { Loader2, Plus, Trash2, Filter } from "lucide-react";

const PAYMENT_MODES = ["CASH", "BANK", "WALLET", "CARD", "UPI"];
const CATEGORIES = ["Food", "Transport", "Groceries", "Entertainment", "Bills", "Shopping", "Health", "Other"];

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Personal Expenses</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Expense
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-900/50 border border-rose-700 rounded-lg text-rose-200">
          {error}
        </div>
      )}

      {/* Add Expense Form */}
      {showForm && (
        <div className="card">
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
                <tr className="text-left text-slate-400 text-sm border-b border-slate-700">
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
                  <tr key={expense._id} className="border-b border-slate-800">
                    <td className="py-3 text-slate-300">
                      {new Date(expense.date).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-1 bg-slate-700 rounded text-sm">{expense.category}</span>
                    </td>
                    <td className="py-3 text-slate-300">{expense.description || "-"}</td>
                    <td className="py-3 text-slate-400 text-sm">{expense.paymentMode}</td>
                    <td className="py-3 text-right font-medium text-slate-100">
                      {formatMoney(expense.amountMinor, user?.currency)}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleDelete(expense._id)}
                        className="p-2 text-slate-400 hover:text-rose-400"
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
