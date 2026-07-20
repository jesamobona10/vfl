"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Plus, Edit2, Trash2, X, Check, Loader2, AlertCircle, Building2 } from "lucide-react";

interface TeamRow {
  id: number;
  name: string;
  organization_id: string;
  rating: number;
  logo_url?: string;
  created_at: string;
  playerCount: number;
  organizations?: { name: string; slug: string } | null;
}

interface OrgSummary {
  id: string;
  name: string;
  slug: string;
}

export function AdminTeamManager() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterOrg, setFilterOrg] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formName, setFormName] = useState("");
  const [formOrgId, setFormOrgId] = useState("");
  const [formRating, setFormRating] = useState("6.0");

  const fetchTeams = useCallback(async () => {
    try {
      const params = filterOrg ? `?org_id=${filterOrg}` : "";
      const [teamsRes, orgsRes] = await Promise.all([
        fetch(`/api/admin/teams${params}`),
        fetch("/api/admin/orgs"),
      ]);
      const teamsData = await teamsRes.json();
      const orgsData = await orgsRes.json();
      if (teamsRes.ok) setTeams(teamsData.teams || []);
      else setError(teamsData.error || "Failed to load teams");
      if (orgsRes.ok) setOrgs(orgsData.orgs || []);
    } catch { setError("Failed to load data."); }
    finally { setLoading(false); }
  }, [filterOrg]);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  const resetForm = () => {
    setFormName(""); setFormOrgId(""); setFormRating("6.0");
    setEditingTeam(null); setShowForm(false); setError("");
  };

  const openEdit = (team: TeamRow) => {
    setEditingTeam(team);
    setFormName(team.name);
    setFormOrgId(team.organization_id);
    setFormRating(String(team.rating));
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const body = { name: formName, organization_id: formOrgId, rating: Number(formRating) };
      const url = editingTeam ? `/api/admin/teams/${editingTeam.id}` : "/api/admin/teams";
      const method = editingTeam ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save."); return; }
      resetForm();
      fetchTeams();
    } catch { setError("Failed to save team."); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (team: TeamRow) => {
    if (!confirm(`Delete "${team.name}" and all associated players, fixtures, and accounts?`)) return;
    try {
      const res = await fetch(`/api/admin/teams/${team.id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Delete failed."); return; }
      fetchTeams();
    } catch { setError("Failed to delete."); }
  };

  const filteredTeams = filterOrg ? teams : teams;

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-muted" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Teams</h3>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary text-sm">
          <Plus size={14} /> Add Team
        </button>
      </div>

      <div className="flex items-center gap-2">
        <select value={filterOrg} onChange={(e) => setFilterOrg(e.target.value)} className="input text-sm w-auto">
          <option value="">All Organizations</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <span className="text-xs text-muted">{teams.length} team(s)</span>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-4 py-3">
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError("")} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-4 space-y-3 border-l-4 border-l-brand">
          <h4 className="text-sm font-semibold text-muted uppercase">{editingTeam ? "Edit" : "Add"} Team</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input value={formName} onChange={(e) => setFormName(e.target.value)} className="input text-sm" placeholder="Team name" required />
            <select value={formOrgId} onChange={(e) => setFormOrgId(e.target.value)} className="input text-sm" required>
              <option value="">Organization...</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <input type="number" step="0.1" min={0} max={10} value={formRating} onChange={(e) => setFormRating(e.target.value)} className="input text-sm" placeholder="Rating" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={submitting || !formName || !formOrgId} className="btn-primary text-sm">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {editingTeam ? "Update" : "Create"}
            </button>
            <button type="button" onClick={resetForm} className="btn-ghost text-sm">Cancel</button>
          </div>
        </form>
      )}

      {filteredTeams.length === 0 ? (
        <p className="text-sm text-muted text-center py-8">No teams found.</p>
      ) : (
        <div className="space-y-1">
          {filteredTeams.map((team) => (
            <div key={team.id} className="card px-4 py-2.5 flex items-center gap-3 text-sm">
              <Users size={16} className="text-muted shrink-0" />
              <span className="font-medium flex-1">{team.name}</span>
              <span className="text-xs text-muted w-32 truncate">
                <Building2 size={12} className="inline mr-1" />
                {team.organizations?.name || "—"}
              </span>
              <span className="text-xs text-muted w-16">★ {team.rating}</span>
              <span className="text-xs text-muted w-16">{team.playerCount} players</span>
              <button onClick={() => openEdit(team)} className="btn-ghost text-xs"><Edit2 size={12} /></button>
              <button onClick={() => handleDelete(team)} className="btn-ghost text-xs text-danger"><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
