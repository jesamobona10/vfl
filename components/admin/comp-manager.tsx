"use client";

import { useState, useEffect, useCallback } from "react";
import { Trophy, Plus, Edit2, Trash2, X, Check, Loader2, AlertCircle, Building2, Calendar, Swords } from "lucide-react";

interface CompRow {
  id: string;
  name: string;
  organization_id: string;
  type: string;
  season: string | null;
  status: string;
  created_at: string;
  fixtureCount: number;
  cupMatchCount: number;
  organizations?: { name: string; slug: string } | null;
}

interface OrgSummary { id: string; name: string; }

export function CompManager() {
  const [comps, setComps] = useState<CompRow[]>([]);
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterOrg, setFilterOrg] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingComp, setEditingComp] = useState<CompRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formName, setFormName] = useState("");
  const [formOrgId, setFormOrgId] = useState("");
  const [formType, setFormType] = useState("league");
  const [formSeason, setFormSeason] = useState("");
  const [formStatus, setFormStatus] = useState("draft");

  const fetchComps = useCallback(async () => {
    try {
      const params = filterOrg ? `?org_id=${filterOrg}` : "";
      const [compsRes, orgsRes] = await Promise.all([
        fetch(`/api/admin/competitions${params}`),
        fetch("/api/admin/orgs"),
      ]);
      const compsData = await compsRes.json();
      const orgsData = await orgsRes.json();
      if (compsRes.ok) setComps(compsData.competitions || []);
      else setError(compsData.error || "Failed to load competitions");
      if (orgsRes.ok) setOrgs(orgsData.orgs || []);
    } catch { setError("Failed to load data."); }
    finally { setLoading(false); }
  }, [filterOrg]);

  useEffect(() => { fetchComps(); }, [fetchComps]);

  const resetForm = () => {
    setFormName(""); setFormOrgId(""); setFormType("league"); setFormSeason(""); setFormStatus("draft");
    setEditingComp(null); setShowForm(false); setError("");
  };

  const openEdit = (comp: CompRow) => {
    setEditingComp(comp);
    setFormName(comp.name);
    setFormOrgId(comp.organization_id);
    setFormType(comp.type);
    setFormSeason(comp.season || "");
    setFormStatus(comp.status);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { name: formName, type: formType };
      if (editingComp) {
        body.season = formSeason || null;
        body.status = formStatus;
      } else {
        body.organization_id = formOrgId;
        body.season = formSeason || null;
      }
      const url = editingComp ? `/api/admin/competitions/${editingComp.id}` : "/api/admin/competitions";
      const method = editingComp ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save."); return; }
      resetForm();
      fetchComps();
    } catch { setError("Failed to save competition."); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (comp: CompRow) => {
    if (!confirm(`Delete "${comp.name}" and all associated fixtures and cup matches?`)) return;
    try {
      const res = await fetch(`/api/admin/competitions/${comp.id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Delete failed."); return; }
      fetchComps();
    } catch { setError("Failed to delete."); }
  };

  const statusColor = (s: string) => {
    if (s === "active") return "text-green-400";
    if (s === "completed") return "text-blue-400";
    return "text-muted";
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-muted" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Competitions</h3>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary text-sm">
          <Plus size={14} /> Create
        </button>
      </div>

      <div className="flex items-center gap-2">
        <select value={filterOrg} onChange={(e) => setFilterOrg(e.target.value)} className="input text-sm w-auto">
          <option value="">All Organizations</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <span className="text-xs text-muted">{comps.length} competition(s)</span>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-4 py-3">
          <AlertCircle size={16} /> {error} <button onClick={() => setError("")} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-4 space-y-3 border-l-4 border-l-brand">
          <h4 className="text-sm font-semibold text-muted uppercase">{editingComp ? "Edit" : "Create"} Competition</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <input value={formName} onChange={(e) => setFormName(e.target.value)} className="input text-sm" placeholder="Name" required />
            {!editingComp && (
              <select value={formOrgId} onChange={(e) => setFormOrgId(e.target.value)} className="input text-sm" required>
                <option value="">Organization...</option>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            )}
            <select value={formType} onChange={(e) => setFormType(e.target.value)} className="input text-sm">
              <option value="league">League</option><option value="cup">Cup</option><option value="friendly">Friendly</option>
            </select>
            <input value={formSeason} onChange={(e) => setFormSeason(e.target.value)} className="input text-sm" placeholder="Season (e.g. 2025/26)" />
            {editingComp && (
              <select value={formStatus} onChange={(e) => setFormStatus(e.target.value)} className="input text-sm">
                <option value="draft">Draft</option><option value="active">Active</option><option value="completed">Completed</option>
              </select>
            )}
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={submitting || !formName || (!editingComp && !formOrgId)} className="btn-primary text-sm">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {editingComp ? "Update" : "Create"}
            </button>
            <button type="button" onClick={resetForm} className="btn-ghost text-sm">Cancel</button>
          </div>
        </form>
      )}

      {comps.length === 0 ? (
        <p className="text-sm text-muted text-center py-8">No competitions found.</p>
      ) : (
        <div className="space-y-1">
          {comps.map((comp) => (
            <div key={comp.id} className="card px-4 py-2.5 flex items-center gap-3 text-sm">
              <Trophy size={16} className="text-muted shrink-0" />
              <span className="font-medium flex-1">{comp.name}</span>
              <span className="text-xs text-muted w-28 truncate">
                <Building2 size={12} className="inline mr-1" />
                {comp.organizations?.name || "—"}
              </span>
              <span className="text-xs capitalize text-muted w-16">{comp.type}</span>
              <span className={`text-xs capitalize ${statusColor(comp.status)} w-16`}>{comp.status}</span>
              <span className="text-xs text-muted">{comp.season || "—"}</span>
              <span className="text-xs text-muted flex items-center gap-1"><Calendar size={10} />{comp.fixtureCount}</span>
              <span className="text-xs text-muted flex items-center gap-1"><Swords size={10} />{comp.cupMatchCount}</span>
              <button onClick={() => openEdit(comp)} className="btn-ghost text-xs"><Edit2 size={12} /></button>
              <button onClick={() => handleDelete(comp)} className="btn-ghost text-xs text-danger"><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
