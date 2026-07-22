"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Building2, Plus, Edit2, Trash2, X, Check, Loader2, AlertCircle, Users, Upload, Image as ImageIcon } from "lucide-react";

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  type: string;
  logo_url?: string;
  created_at: string;
  teamCount: number;
  memberCount: number;
  competitionCount: number;
}

interface MemberRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  created_at: string;
  auth_users?: { email?: string } | null;
}

export function OrgManager() {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingOrg, setEditingOrg] = useState<OrgRow | null>(null);
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, MemberRow[]>>({});
  const [membersLoading, setMembersLoading] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("school");
  const [formSlug, setFormSlug] = useState("");

  const [logoUploading, setLogoUploading] = useState(false);
  const [editingLogoUrl, setEditingLogoUrl] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [memberFormOrgId, setMemberFormOrgId] = useState<string | null>(null);
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState("admin");
  const [memberSubmitting, setMemberSubmitting] = useState(false);

  const fetchOrgs = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/orgs");
      const data = await res.json();
      if (res.ok) setOrgs(data.orgs || []);
      else setError(data.error || "Failed to load orgs");
    } catch { setError("Failed to load organizations."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  const fetchMembers = async (orgId: string) => {
    setMembersLoading(orgId);
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}/members`);
      const data = await res.json();
      if (res.ok) setMembers((m) => ({ ...m, [orgId]: data.members || [] }));
    } catch {}
    finally { setMembersLoading(null); }
  };

  const toggleExpand = (orgId: string) => {
    if (expandedOrg === orgId) {
      setExpandedOrg(null);
      return;
    }
    setExpandedOrg(orgId);
    if (!members[orgId]) fetchMembers(orgId);
  };

  const resetForm = () => {
    setFormName("");
    setFormType("school");
    setFormSlug("");
    setEditingOrg(null);
    setShowForm(false);
    setError("");
  };

  const openEdit = (org: OrgRow) => {
    setEditingOrg(org);
    setFormName(org.name);
    setFormType(org.type);
    setFormSlug(org.slug);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const url = editingOrg ? `/api/admin/orgs/${editingOrg.id}` : "/api/admin/orgs";
      const method = editingOrg ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName, type: formType, slug: formSlug }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save."); return; }
      resetForm();
      fetchOrgs();
    } catch { setError("Failed to save organization."); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (org: OrgRow) => {
    if (!confirm(`Delete "${org.name}" and all its data? This CANNOT be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/orgs/${org.id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Delete failed."); return; }
      fetchOrgs();
    } catch { setError("Failed to delete."); }
  };

  const handleAddMember = async (orgId: string) => {
    if (!memberUserId.trim()) return;
    setMemberSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: memberUserId.trim(), role: memberRole }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to add member."); return; }
      setMemberUserId("");
      setMemberFormOrgId(null);
      fetchMembers(orgId);
    } catch { setError("Failed to add member."); }
    finally { setMemberSubmitting(false); }
  };

  const handleRemoveMember = async (orgId: string, userId: string) => {
    if (!confirm("Remove this member?")) return;
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}/members/${userId}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Remove failed."); return; }
      fetchMembers(orgId);
    } catch { setError("Failed to remove member."); }
  };

  const handleChangeRole = async (orgId: string, userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Role change failed."); return; }
      fetchMembers(orgId);
    } catch { setError("Failed to change role."); }
  };

  const handleLogoUpload = async (orgId: string, orgName: string, file: File) => {
    if (!file.type.startsWith("image/")) { alert("Please select an image file."); return; }
    if (file.size > 2 * 1024 * 1024) { alert("File too large. Max 2MB."); return; }
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("orgId", orgId);
      formData.append("orgName", orgName);
      const res = await fetch("/api/upload/org-logo", { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }
      setEditingLogoUrl(data.url);
    } catch { alert("Upload failed."); }
    finally { setLogoUploading(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-muted" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Organizations</h3>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary text-sm">
          <Plus size={14} /> Create
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-4 py-3">
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError("")} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-4 space-y-3 border-l-4 border-l-brand">
          <h4 className="text-sm font-semibold text-muted uppercase">{editingOrg ? "Edit" : "Create"} Organization</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input value={formName} onChange={(e) => setFormName(e.target.value)} className="input text-sm" placeholder="Name" required />
            <select value={formType} onChange={(e) => setFormType(e.target.value)} className="input text-sm">
              <option value="school">School</option><option value="academy">Academy</option><option value="club">Club</option>
            </select>
            <input value={formSlug} onChange={(e) => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} className="input text-sm" placeholder="slug (e.g. my-school)" required />
          </div>
          {editingOrg && (
            <div className="flex items-center gap-3 pt-1">
              <div
                className="w-14 h-14 rounded-xl bg-surface-2 flex items-center justify-center overflow-hidden border border-line cursor-pointer"
                onClick={() => logoInputRef.current?.click()}
              >
                {(editingLogoUrl || editingOrg.logo_url) ? (
                  <img src={editingLogoUrl || editingOrg.logo_url!} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={22} className="text-muted/40" />
                )}
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && editingOrg) handleLogoUpload(editingOrg.id, editingOrg.name, file);
              }} className="hidden" />
              <button type="button" onClick={() => logoInputRef.current?.click()} disabled={logoUploading} className="btn-ghost text-xs">
                {logoUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                {editingOrg.logo_url || editingLogoUrl ? "Change Logo" : "Upload Logo"}
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={submitting || !formName || !formSlug} className="btn-primary text-sm">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {editingOrg ? "Update" : "Create"}
            </button>
            <button type="button" onClick={resetForm} className="btn-ghost text-sm">Cancel</button>
          </div>
        </form>
      )}

      {orgs.length === 0 ? (
        <p className="text-sm text-muted text-center py-8">No organizations yet.</p>
      ) : (
        <div className="space-y-2">
          {orgs.map((org) => (
            <div key={org.id}>
              <div className="card px-4 py-3 flex items-center gap-3">
                {org.logo_url ? (
                  <img src={org.logo_url} alt={org.name} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                ) : (
                  <Building2 size={18} className="text-muted shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{org.name}</p>
                  <p className="text-xs text-muted">
                    {org.slug} &middot; <span className="capitalize">{org.type}</span> &middot;
                    {org.teamCount} teams &middot; {org.memberCount} members &middot; {org.competitionCount} comps
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => toggleExpand(org.id)} className="btn-ghost text-xs" title="Members">
                    <Users size={14} />
                  </button>
                  <button onClick={() => openEdit(org)} className="btn-ghost text-xs" title="Edit">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(org)} className="btn-ghost text-xs text-danger" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {expandedOrg === org.id && (
                <div className="ml-6 mt-1 mb-2 card p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-semibold text-muted uppercase">Members ({members[org.id]?.length || 0})</h5>
                    <button onClick={() => setMemberFormOrgId(org.id)} className="btn-ghost text-xs">
                      <Plus size={12} /> Add
                    </button>
                  </div>

                  {memberFormOrgId === org.id && (
                    <div className="flex items-center gap-2">
                      <input value={memberUserId} onChange={(e) => setMemberUserId(e.target.value)} className="input text-xs flex-1" placeholder="User ID (UUID)" />
                      <select value={memberRole} onChange={(e) => setMemberRole(e.target.value)} className="input text-xs w-auto">
                        <option value="owner">Owner</option><option value="admin">Admin</option><option value="coach">Coach</option><option value="player">Player</option>
                      </select>
                      <button onClick={() => handleAddMember(org.id)} disabled={memberSubmitting || !memberUserId.trim()} className="btn-primary text-xs">
                        {memberSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Add
                      </button>
                      <button onClick={() => setMemberFormOrgId(null)} className="btn-ghost text-xs"><X size={12} /></button>
                    </div>
                  )}

                  {membersLoading === org.id ? (
                    <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-muted" /></div>
                  ) : !members[org.id]?.length ? (
                    <p className="text-xs text-muted text-center py-4">No members.</p>
                  ) : (
                    <div className="space-y-1">
                      {members[org.id].map((m) => (
                        <div key={m.id} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded-lg bg-surface-2">
                          <span className="font-mono flex-1 truncate">{m.user_id}</span>
                          <select value={m.role} onChange={(e) => handleChangeRole(org.id, m.user_id, e.target.value)} className="input text-xs w-auto py-0.5">
                            <option value="owner">Owner</option><option value="admin">Admin</option><option value="coach">Coach</option><option value="player">Player</option>
                          </select>
                          <button onClick={() => handleRemoveMember(org.id, m.user_id)} className="btn-icon text-danger" title="Remove">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
