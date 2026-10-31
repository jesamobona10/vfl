"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MailPlus, RefreshCw, Shield, Trash2, Users } from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingState } from "@/components/shared/skeleton";
import type { OrgRole } from "@/lib/types";

type StaffMember = { id: string; user_id: string; organization_id: string; role: OrgRole; email?: string | null; created_at: string };
const roleDescriptions: Record<OrgRole, string> = {
  owner: "Full organization control, including staff invitations.",
  admin: "Manage organization competitions, teams, players and matches.",
  coach: "Manage assigned team activities and submit lineups.",
  player: "Access the player account experience.",
};

export default function OrganizationStaffPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: organization } = useOrg(slug);
  const userProfile = useAppStore((state) => state.userProfile);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<OrgRole, "owner">>("coach");
  const [saving, setSaving] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const isOrgAdmin = userProfile?.role === "super_admin" || userProfile?.orgRole === "owner" || userProfile?.orgRole === "admin";
  const canInvite = userProfile?.role === "super_admin" || userProfile?.orgRole === "owner";
  const queryKey = ["staff-members", organization?.id];
  const membersQuery = useQuery({
    queryKey,
    enabled: Boolean(organization?.id && isOrgAdmin),
    queryFn: async () => {
      const response = await fetch(`/api/org/members?org_id=${encodeURIComponent(organization!.id)}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load organization staff.");
      return (Array.isArray(body.members) ? body.members : []) as StaffMember[];
    },
  });
  const members = useMemo(() => [...(membersQuery.data || [])].sort((a, b) => a.role.localeCompare(b.role) || (a.email || a.user_id).localeCompare(b.email || b.user_id)), [membersQuery.data]);

  async function inviteMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization || !canInvite || saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/org/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: organization.id, email: email.trim(), role }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to invite staff member.");
      setEmail("");
      toast.success(`Invitation sent to ${email.trim()}.`);
      await queryClient.invalidateQueries({ queryKey });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to invite staff member.");
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(member: StaffMember) {
    if (!organization || !canInvite || removingUserId) return;
    const label = member.email || `member ${member.user_id.slice(0, 8)}`;
    if (!(await confirm({ title: "Remove organization member?", description: `${label} will lose access to ${organization.name}.`, confirmLabel: "Remove member" }))) return;
    setRemovingUserId(member.user_id);
    try {
      const response = await fetch(`/api/org/members?org_id=${encodeURIComponent(organization.id)}&user_id=${encodeURIComponent(member.user_id)}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to remove organization member.");
      toast.success("Member removed.");
      await queryClient.invalidateQueries({ queryKey });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove organization member.");
    } finally {
      setRemovingUserId(null);
    }
  }

  if (!isOrgAdmin) return <EmptyState title="Staff management is restricted" description="Only organization administrators can view organization staff." />;

  return <div className="mx-auto max-w-5xl space-y-6">
    {dialog}
    <header><p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">People</p><h1 className="mt-1 text-2xl font-bold">Staff and access</h1><p className="mt-1 text-sm text-muted">Invite individual staff accounts and review who has access to {organization?.name || "this organization"}.</p></header>

    {canInvite ? <form onSubmit={(event) => void inviteMember(event)} className="card grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end">
      <Input label="Staff email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" hint="An invitation email will be sent if they do not have an account yet." />
      <label className="block text-sm font-medium text-text">Organization role<select value={role} onChange={(event) => setRole(event.target.value as Exclude<OrgRole, "owner">)} className="input mt-1 w-full"><option value="admin">Administrator</option><option value="coach">Coach</option></select></label>
      <Button type="submit" loading={saving} disabled={!organization} leftIcon={<MailPlus size={16} />}>Send invite</Button>
    </form> : <div className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">Only an organization owner can invite or remove members. You can review the current staff list below.</div>}

    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-5"><div><h2 className="font-semibold">Organization members</h2><p className="mt-0.5 text-xs text-muted">Role visibility follows your organization membership.</p></div><span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold">{members.length} members</span></header>
      {membersQuery.isLoading ? <LoadingState label="Loading organization staff" /> : membersQuery.isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 p-5"><p className="text-sm text-danger">{membersQuery.error instanceof Error ? membersQuery.error.message : "Unable to load staff."}</p><Button size="sm" variant="secondary" onClick={() => void membersQuery.refetch()} leftIcon={<RefreshCw size={14} />}>Retry</Button></div> : members.length === 0 ? <EmptyState title="No organization members found" description="Send an invitation to add the first staff account." /> : <ul className="divide-y divide-line">{members.map((member) => <li key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand"><Users size={17} /></span>
        <span className="min-w-0 flex-1"><span className="block break-all text-sm font-semibold">{member.email || `Member ${member.user_id.slice(0, 8)}…`}</span><span className="mt-0.5 block text-xs text-muted">{roleDescriptions[member.role]}{member.email ? "" : ` · ID ${member.user_id}`}</span></span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold capitalize"><Shield size={13} />{member.role}</span>
        {canInvite && member.user_id !== userProfile?.id && <Button variant="ghost" size="icon" aria-label={`Remove ${member.email || "member"}`} title="Remove member" loading={removingUserId === member.user_id} disabled={removingUserId !== null} onClick={() => void removeMember(member)} className="text-muted hover:text-danger"><Trash2 size={16} /></Button>}
      </li>)}</ul>}
    </section>
  </div>;
}
