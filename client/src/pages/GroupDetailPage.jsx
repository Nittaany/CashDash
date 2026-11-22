import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api/client.js";
import { formatMoney, toMinorUnits } from "../utils/currency.js";
import {
  Loader2,
  Plus,
  Trash2,
  Download,
  UserPlus,
  Copy,
  Check,
  ArrowRight
} from "lucide-react";

export function GroupDetailPage() {
  const { groupId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add member form
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  // Add expense form
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    description: "",
    amount: "",
    splitType: "EQUAL",
    participants: []
  });
  const [exactShares, setExactShares] = useState({});
  const [percentShares, setPercentShares] = useState({});
  const [submittingExpense, setSubmittingExpense] = useState(false);

  // Settlement form
  const [showSettlementForm, setShowSettlementForm] = useState(false);
  const [settlementForm, setSettlementForm] = useState({ toUserId: "", amount: "" });
  const [submittingSettlement, setSubmittingSettlement] = useState(false);

  const [copiedHandle, setCopiedHandle] = useState(null);

  useEffect(() => {
    loadSummary();
  }, [groupId]);

  const loadSummary = async () => {
    try {
      const data = await api.get(`/api/groups/${groupId}/summary`);
      setSummary(data);

      // Initialize participants with all members
      if (data.group?.members) {
        setExpenseForm((p) => ({
          ...p,
          participants: data.group.members.map((m) => m._id)
        }));
      }
    } catch (err) {
      setError(err.message);
      if (err.message.includes("Not a member")) {
        navigate("/groups");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    setError("");
    setAddingMember(true);

    try {
      await api.post(`/api/groups/${groupId}/members`, { email: memberEmail });
      setMemberEmail("");
      setShowAddMember(false);
      await loadSummary();
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingMember(false);
    }
  };

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const amountMinor = toMinorUnits(expenseForm.amount);
    if (!amountMinor) {
      setError("Please enter a valid amount greater than 0");
      return;
    }

    if (expenseForm.participants.length === 0) {
      setError("Select at least one participant");
      return;
    }

    setSubmittingExpense(true);

    try {
      const payload = {
        description: expenseForm.description,
        amountMinor,
        payerId: user.id,
        splitType: expenseForm.splitType,
        participants: expenseForm.participants
      };

      if (expenseForm.splitType === "EXACT") {
        payload.exactSharesMinor = {};
        for (const pid of expenseForm.participants) {
          const share = toMinorUnits(exactShares[pid] || "0");
          if (share) payload.exactSharesMinor[pid] = share;
        }
      } else if (expenseForm.splitType === "PERCENT") {
        payload.percentShares = {};
        for (const pid of expenseForm.participants) {
          const pct = parseFloat(percentShares[pid] || "0");
          if (pct > 0) payload.percentShares[pid] = pct;
        }
      }

      await api.post(`/api/groups/${groupId}/expenses`, payload);
      setExpenseForm({ description: "", amount: "", splitType: "EQUAL", participants: summary?.group?.members?.map((m) => m._id) || [] });
      setExactShares({});
      setPercentShares({});
      setShowExpenseForm(false);
      await loadSummary();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingExpense(false);
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!confirm("Delete this expense?")) return;

    try {
      await api.delete(`/api/groups/${groupId}/expenses/${expenseId}`);
      await loadSummary();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSettlement = async (e) => {
    e.preventDefault();
    setError("");

    const amountMinor = toMinorUnits(settlementForm.amount);
    if (!amountMinor) {
      setError("Please enter a valid amount");
      return;
    }

    setSubmittingSettlement(true);

    try {
      await api.post(`/api/groups/${groupId}/settlements`, {
        fromUserId: user.id,
        toUserId: settlementForm.toUserId,
        amountMinor
      });
      setSettlementForm({ toUserId: "", amount: "" });
      setShowSettlementForm(false);
      await loadSummary();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingSettlement(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      await api.download(`/api/groups/${groupId}/export.csv`, `${summary?.group?.name || "group"}_expenses.csv`);
    } catch (err) {
      setError(err.message);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedHandle(id);
    setTimeout(() => setCopiedHandle(null), 2000);
  };

  const toggleParticipant = (memberId) => {
    setExpenseForm((p) => {
      const newParticipants = p.participants.includes(memberId)
        ? p.participants.filter((id) => id !== memberId)
        : [...p.participants, memberId];

      // Clear stale shares for removed participants
      if (!newParticipants.includes(memberId)) {
        setExactShares((prev) => {
          const next = { ...prev };
          delete next[memberId];
          return next;
        });
        setPercentShares((prev) => {
          const next = { ...prev };
          delete next[memberId];
          return next;
        });
      }

      return { ...p, participants: newParticipants };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  const group = summary?.group;
  const members = group?.members || [];
  const expenses = summary?.expenses || [];
  const netBalances = summary?.netBalances || {};
  const simplifiedTransfers = summary?.simplifiedTransfers || [];

  const getMemberName = (id) => members.find((m) => m._id === id)?.name || "Unknown";

  const totalPercent = Object.values(percentShares).reduce((s, v) => s + parseFloat(v || 0), 0);
  const totalExact = Object.values(exactShares).reduce((s, v) => s + (toMinorUnits(v) || 0), 0);
  const targetAmountMinor = toMinorUnits(expenseForm.amount) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{group?.name}</h1>
          {group?.description && <p className="text-slate-400 mt-1">{group.description}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportCSV} className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button onClick={() => setShowExpenseForm(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-900/50 border border-rose-700 rounded-lg text-rose-200">
          {error}
        </div>
      )}

      {/* Members */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-100">Members ({members.length})</h2>
          <button onClick={() => setShowAddMember(!showAddMember)} className="btn-secondary text-sm flex items-center gap-1">
            <UserPlus className="w-4 h-4" />
            Add
          </button>
        </div>

        {showAddMember && (
          <form onSubmit={handleAddMember} className="flex gap-2 mb-4">
            <input
              type="email"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              placeholder="friend@email.com"
              required
              className="flex-1"
            />
            <button type="submit" disabled={addingMember} className="btn-primary">
              {addingMember ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
            </button>
          </form>
        )}

        <div className="flex flex-wrap gap-2">
          {members.map((member) => (
            <div key={member._id} className="px-3 py-2 bg-slate-800 rounded-lg">
              <span className="text-slate-100">{member.name}</span>
              <span className="text-slate-500 text-sm ml-2">{member.email}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Simplified Settlements */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-100">Settle Up</h2>
          {simplifiedTransfers.some((t) => t.fromUserId === user.id) && (
            <button onClick={() => setShowSettlementForm(!showSettlementForm)} className="btn-primary text-sm">
              Record Payment
            </button>
          )}
        </div>

        {showSettlementForm && (
          <form onSubmit={handleSettlement} className="flex gap-2 mb-4 flex-wrap">
            <select
              value={settlementForm.toUserId}
              onChange={(e) => setSettlementForm((p) => ({ ...p, toUserId: e.target.value }))}
              required
              className="flex-1 min-w-[150px]"
            >
              <option value="">Pay to...</option>
              {simplifiedTransfers
                .filter((t) => t.fromUserId === user.id)
                .map((t) => (
                  <option key={t.toUserId} value={t.toUserId}>
                    {getMemberName(t.toUserId)}
                  </option>
                ))}
            </select>
            <input
              type="text"
              value={settlementForm.amount}
              onChange={(e) => setSettlementForm((p) => ({ ...p, amount: e.target.value }))}
              placeholder="Amount"
              required
              className="w-32"
            />
            <button type="submit" disabled={submittingSettlement} className="btn-primary">
              {submittingSettlement ? <Loader2 className="w-4 h-4 animate-spin" /> : "Pay"}
            </button>
          </form>
        )}

        {simplifiedTransfers.length === 0 ? (
          <p className="text-emerald-500">All settled up! 🎉</p>
        ) : (
          <div className="space-y-3">
            {simplifiedTransfers.map((transfer, i) => {
              const fromMember = members.find((m) => m._id === transfer.fromUserId);
              const toMember = members.find((m) => m._id === transfer.toUserId);
              const isYou = transfer.fromUserId === user.id;

              return (
                <div key={i} className={`flex items-center justify-between p-3 rounded-lg ${isYou ? "bg-rose-900/30 border border-rose-800" : "bg-slate-800"}`}>
                  <div className="flex items-center gap-2">
                    <span className={isYou ? "text-rose-300 font-medium" : "text-slate-300"}>
                      {isYou ? "You" : fromMember?.name}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-500" />
                    <span className="text-slate-300">{toMember?.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-100">
                      {formatMoney(transfer.amountMinor, group?.currency)}
                    </span>
                    {toMember?.paymentHandle && (
                      <button
                        onClick={() => copyToClipboard(toMember.paymentHandle, toMember._id)}
                        className="p-1 text-slate-400 hover:text-emerald-400"
                        title={toMember.paymentHandle}
                      >
                        {copiedHandle === toMember._id ? (
                          <Check className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      {showExpenseForm && (
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Add Expense</h2>
          <form onSubmit={handleExpenseSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description *</label>
                <input
                  type="text"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="What was the expense for?"
                  required
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Total Amount *</label>
                <input
                  type="text"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="0.00"
                  required
                  className="w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Split Type</label>
              <select
                value={expenseForm.splitType}
                onChange={(e) => setExpenseForm((p) => ({ ...p, splitType: e.target.value }))}
                className="w-full"
              >
                <option value="EQUAL">Equal Split</option>
                <option value="EXACT">Exact Amounts</option>
                <option value="PERCENT">Percentage</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Participants</label>
              <div className="flex flex-wrap gap-2">
                {members.map((member) => (
                  <button
                    key={member._id}
                    type="button"
                    onClick={() => toggleParticipant(member._id)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      expenseForm.participants.includes(member._id)
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    {member.name}
                  </button>
                ))}
              </div>
            </div>

            {expenseForm.splitType === "EXACT" && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Exact Shares (Total: {formatMoney(totalExact, group?.currency)} / {formatMoney(targetAmountMinor, group?.currency)})
                </label>
                <div className="grid md:grid-cols-2 gap-2">
                  {expenseForm.participants.map((pid) => (
                    <div key={pid} className="flex items-center gap-2">
                      <span className="text-slate-400 text-sm w-24 truncate">{getMemberName(pid)}</span>
                      <input
                        type="text"
                        value={exactShares[pid] || ""}
                        onChange={(e) => setExactShares((p) => ({ ...p, [pid]: e.target.value }))}
                        placeholder="0.00"
                        className="flex-1"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {expenseForm.splitType === "PERCENT" && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Percentages (Total: {totalPercent.toFixed(2)}%)
                </label>
                <div className="grid md:grid-cols-2 gap-2">
                  {expenseForm.participants.map((pid) => (
                    <div key={pid} className="flex items-center gap-2">
                      <span className="text-slate-400 text-sm w-24 truncate">{getMemberName(pid)}</span>
                      <input
                        type="number"
                        step="0.01"
                        value={percentShares[pid] || ""}
                        onChange={(e) => setPercentShares((p) => ({ ...p, [pid]: e.target.value }))}
                        placeholder="0"
                        className="flex-1"
                      />
                      <span className="text-slate-500">%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button type="submit" disabled={submittingExpense} className="btn-primary flex items-center gap-2">
                {submittingExpense && <Loader2 className="w-4 h-4 animate-spin" />}
                Add Expense
              </button>
              <button type="button" onClick={() => setShowExpenseForm(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Expenses History */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-100 mb-4">Expenses ({expenses.length})</h2>
        {expenses.length === 0 ? (
          <p className="text-slate-400">No expenses yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-slate-400 text-sm border-b border-slate-700">
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Description</th>
                  <th className="pb-3 font-medium">Paid By</th>
                  <th className="pb-3 font-medium">Split</th>
                  <th className="pb-3 font-medium text-right">Amount</th>
                  <th className="pb-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => {
                  const canDelete = expense.payerId?._id === user.id || group?.createdBy === user.id;
                  return (
                    <tr key={expense._id} className="border-b border-slate-800">
                      <td className="py-3 text-slate-300">
                        {new Date(expense.date).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-slate-100">{expense.description}</td>
                      <td className="py-3 text-slate-300">{expense.payerId?.name}</td>
                      <td className="py-3 text-slate-400 text-sm">{expense.splitType}</td>
                      <td className="py-3 text-right font-medium text-slate-100">
                        {formatMoney(expense.amountMinor, group?.currency)}
                      </td>
                      <td className="py-3 text-right">
                        {canDelete && (
                          <button
                            onClick={() => handleDeleteExpense(expense._id)}
                            className="p-2 text-slate-400 hover:text-rose-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
