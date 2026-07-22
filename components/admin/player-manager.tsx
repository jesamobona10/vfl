"use client";

import { useState, useEffect, useCallback } from "react";
import { UserCog, Plus, Edit2, Trash2, X, Check, Loader2, AlertCircle, Building2, Users } from "lucide-react";

interface PlayerRow {
  id: number;
  teamId: number;
  teamName: string | null;
  organizationId: string | null;
  name: string;
  position: string;
  number: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  rating: number;
}

interface OrgSummary { id: string; name: string; }
interface TeamSummary { id: number; name: string; organization_id: string; }

export function AdminPlayerManager() {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterOrg, setFilterOrg] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<PlayerRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formName, setFormName] = useState("");
  const [formTeamId, setFormTeamId] = useState("");
  const [formPosition, setFormPosition] = useState("MID");
  const [formNumber, setFormNumber] = useState("");

  const fetchPlayers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterTeam) params.set("team_id", filterTeam);
      else if (filterOrg) params.set("org_id", filterOrg);

      const [playersRes, orgsRes, teamsRes] = await Promise.all([
        fetch(`/api/admin/players?${params}`),
        fetch("/api/admin/orgs"),
        fetch("/api/admin/teams"),
      ]);
      const playersData = await playersRes.json();
      const orgsData = await orgsRes.json();
      const teamsData = await teamsRes.json();
      if (playersRes.ok) setPlayers(playersData.players || []);
      if (orgsRes.ok) setOrgs(orgsData.orgs || []);
      if (teamsRes.ok) setTeams(teamsData.teams || []);
    } catch { setError("Failed to load data."); }
    finally { setLoading(false); }
  }, [filterOrg, filterTeam]);

  useEffect(() => { fetchPlayers(); }, [fetchPlayers]);

  const filteredTeams = filterOrg ? teams.filter((t) => t.organization_id === filterOrg) : teams;

  const resetForm = () => {
    setFormName(""); setFormTeamId(""); setFormPosition("MID"); setFormNumber("");
    setEditingPlayer(null); setShowForm(false); setError("");
  };

  const openEdit = (player: PlayerRow) => {
    setEditingPlayer(player);
    setFormName(player.name);
    setFormTeamId(String(player.teamId));
    setFormPosition(player.position);
    setFormNumber(String(player.number));
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const body = { name: formName, team_id: Number(formTeamId), position: formPosition, jersey_number: Number(formNumber) };
      const url = editingPlayer ? `/api/admin/players/${editingPlayer.id}` : "/api/admin/players";
      const method = editingPlayer ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save."); return; }
      resetForm();
      fetchPlayers();
    } catch { setError("Failed to save player."); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (player: PlayerRow) => {
    if (!confirm(`Delete player "${player.name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/players/${player.id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Delete failed."); return; }
      fetchPlayers();
    } catch { setError("Failed to delete."); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-muted" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Players</h3>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary text-sm">
          <Plus size={14} /> Add Player
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={filterOrg} onChange={(e) => { setFilterOrg(e.target.value); setFilterTeam(""); }} className="input text-sm w-auto">
          <option value="">All Organizations</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)} className="input text-sm w-auto">
          <option value="">All Teams</option>
          {filteredTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <span className="text-xs text-muted">{players.length} player(s)</span>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-4 py-3">
          <AlertCircle size={16} /> {error} <button onClick={() => setError("")} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-4 space-y-3 border-l-4 border-l-brand">
          <h4 className="text-sm font-semibold text-muted uppercase">{editingPlayer ? "Edit" : "Add"} Player</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <input value={formName} onChange={(e) => setFormName(e.target.value)} className="input text-sm" placeholder="Name" required />
            <select value={formTeamId} onChange={(e) => setFormTeamId(e.target.value)} className="input text-sm" required>
              <option value="">Team...</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select value={formPosition} onChange={(e) => setFormPosition(e.target.value)} className="input text-sm">
              <option value="GK">GK</option><option value="DEF">DEF</option><option value="MID">MID</option><option value="ATT">ATT</option>
            </select>
            <input type="number" min={1} max={99} value={formNumber} onChange={(e) => setFormNumber(e.target.value)} className="input text-sm" placeholder="Number" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={submitting || !formName || !formTeamId} className="btn-primary text-sm">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {editingPlayer ? "Update" : "Create"}
            </button>
            <button type="button" onClick={resetForm} className="btn-ghost text-sm">Cancel</button>
          </div>
        </form>
      )}

      {players.length === 0 ? (
        <p className="text-sm text-muted text-center py-8">No players found.</p>
      ) : (
        <div className="space-y-1">
          {players.map((p) => (
            <div key={p.id} className="card px-4 py-2 flex items-center gap-3 text-sm">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-xs font-bold text-white shrink-0">
                {p.name.charAt(0).toUpperCase()}
              </div>
              <span className="w-8 text-muted text-xs">#{p.number}</span>
              <span className="font-medium flex-1">{p.name}</span>
              <span className="text-xs text-muted w-10">{p.position}</span>
              <span className="text-xs text-muted w-28 truncate">{p.teamName || "—"}</span>
              <span className="text-xs text-muted">G:{p.goals} A:{p.assists}</span>
              <button onClick={() => openEdit(p)} className="btn-ghost text-xs"><Edit2 size={12} /></button>
              <button onClick={() => handleDelete(p)} className="btn-ghost text-xs text-danger"><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
