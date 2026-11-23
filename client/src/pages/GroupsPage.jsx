import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { Loader2, Plus, Users, ArrowRight } from "lucide-react";

export function GroupsPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    currency: "NPR",
    memberEmails: ""
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const { groups: data } = await api.get("/api/groups");
      setGroups(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const memberEmails = formData.memberEmails
        .split(",")
        .map((e) => e.trim())
        .filter((e) => e);

      const { group } = await api.post("/api/groups", {
        name: formData.name,
        description: formData.description,
        currency: formData.currency,
        memberEmails: memberEmails.length > 0 ? memberEmails : undefined
      });

      setGroups((prev) => [...prev, group]);
      setFormData({ name: "", description: "", currency: "NPR", memberEmails: "" });
      setShowForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
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
        <h1>Groups</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create Group
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {/* Create Group Form */}
      {showForm && (
        <div className="card animate-slide-up">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">New Group</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Group Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g., Pokhara Trip"
                required
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                placeholder="What's this group for?"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Currency</label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData((p) => ({ ...p, currency: e.target.value }))}
                className="w-full"
              >
                <option value="NPR">NPR - Nepali Rupee</option>
                <option value="INR">INR - Indian Rupee</option>
                <option value="USD">USD - US Dollar</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Invite Members (emails, comma-separated)
              </label>
              <input
                type="text"
                value={formData.memberEmails}
                onChange={(e) => setFormData((p) => ({ ...p, memberEmails: e.target.value }))}
                placeholder="friend1@email.com, friend2@email.com"
                className="w-full"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Group
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Groups List */}
      {groups.length === 0 ? (
        <div className="card text-center py-12">
          <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No groups yet. Create one to start splitting expenses!</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4 stagger-children">
          {groups.map((group) => (
            <Link
              key={group._id}
              to={`/groups/${group._id}`}
              className="card animate-fade-up border border-white/[0.06]
                         hover:border-emerald-500/30 hover:bg-[#0f1520] hover:-translate-y-0.5
                         transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">{group.name}</h3>
                  {group.description && (
                    <p className="text-slate-400 text-sm mt-1">{group.description}</p>
                  )}
                  <p className="text-slate-500 text-sm mt-2">
                    {group.members?.length || 0} members · {group.currency}
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-500" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
