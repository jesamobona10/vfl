"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useOrg } from "@/lib/hooks/use-org";
import { Plus, UserCog, Key, Check, AlertCircle, Eye, EyeOff, Trash2 } from "lucide-react";
import { SkeletonList } from "@/components/shared/skeleton";
import { useConfirm } from "@/components/shared/confirm-dialog";

interface TeamAccount {
  id: string;
  username: string;
  display_name: string;
  team_id: number;
  role: string;
  created_at: string;
  teams: { name: string } | null;
}

export default function OrgTeamAccountsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { data: currentOrg } = useOrg(slug);
  const teams = useAppStore((s) => s.teams);

  const [accounts, setAccounts] = useState<TeamAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [createdAccount, setCreatedAccount] = useState<{
    username: string;
    displayName: string;
  } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (account: TeamAccount) => {
    if (
      !(await confirm({
        title: `Delete account "${account.username}"?`,
        description: "This cannot be undone.",
      }))
    )
      return;
    setMessage(null);
    setDeletingId(account.id);
    try {
      const res = await fetch(`/api/org/team-accounts/${account.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed to delete account." });
        return;
      }
      setMessage({ type: "success", text: `Account "${account.username}" deleted.` });
      fetchAccounts();
    } catch {
      setMessage({ type: "error", text: "Failed to delete account." });
    } finally {
      setDeletingId(null);
    }
  };

  const fetchAccounts = async () => {
    if (!currentOrg?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/org/team-accounts?org_id=${currentOrg.id}`);
      const data = await res.json();
      if (res.ok) setAccounts(data.accounts || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [currentOrg?.id]);

  const handleCreate = async () => {
    if (!selectedTeamId || !password || !currentOrg?.id) return;
    const team = teams.find((t) => t.id === Number(selectedTeamId));
    if (!team) return;

    setCreating(true);
    setMessage(null);
    setCreatedAccount(null);

    try {
      const res = await fetch("/api/org/team-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: currentOrg.id,
          teamId: Number(selectedTeamId),
          teamName: team.name,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed to create account." });
        return;
      }
      setCreatedAccount(data.account);
      setMessage({ type: "success", text: "Team account created successfully!" });
      setSelectedTeamId("");
      setPassword("");
      setShowForm(false);
      fetchAccounts();
    } catch {
      setMessage({ type: "error", text: "Unable to create account. Please try again." });
    } finally {
      setCreating(false);
    }
  };

  const unassignedTeams = teams.filter((t) => !accounts.some((a) => a.team_id === t.id));

  return (
    <div className="space-y-5">
      {confirmDialog}
      <div className="page-head">
        <div>
          <p className="page-title">Team Accounts</p>
          <p className="page-sub">
            {accounts.length} account{accounts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus size={16} />
          {showForm ? "Cancel" : "Create Account"}
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6 space-y-4 border-l-4 border-l-brand">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Key size={18} className="text-brand" />
            New Team Account
          </h2>

          <div>
            <label className="block text-sm font-medium mb-1">Team</label>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="input w-full"
            >
              <option value="">Select a team...</option>
              {unassignedTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {unassignedTeams.length === 0 && (
              <p className="text-xs text-muted mt-1">All teams already have accounts.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input w-full pr-10"
                placeholder="Min 12 chars, uppercase + lowercase + number"
                minLength={12}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={creating || !selectedTeamId || password.length < 12}
            className="btn-primary flex items-center gap-2"
          >
            {creating ? (
              <span className="block w-4 h-4 bg-surface-2 rounded animate-pulse" />
            ) : (
              <UserCog size={14} />
            )}
            {creating ? "Creating..." : "Create Account"}
          </button>
        </div>
      )}

      {message && (
        <div
          className={`flex items-start gap-2 text-sm p-3 rounded-lg mb-6 ${
            message.type === "success" ? "text-live-500 bg-live-tint" : "text-danger bg-danger/10"
          }`}
        >
          {message.type === "success" ? (
            <Check size={16} className="mt-0.5 shrink-0" />
          ) : (
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {createdAccount && (
        <div className="card p-6 mb-6 border border-live-500/30 bg-live-tint space-y-3">
          <h3 className="font-semibold flex items-center gap-2 text-live-500">
            <Check size={18} />
            Account Created
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-ink-2">Team</span>
              <p className="font-medium">{createdAccount.displayName}</p>
            </div>
            <div>
              <span className="text-ink-2">Username</span>
              <p className="font-mono font-medium">{createdAccount.username}</p>
            </div>
            <div>
              <span className="text-ink-2">Password</span>
              <p className="font-mono text-ink-2">(as entered)</p>
            </div>
            <div>
              <span className="text-ink-2">Role</span>
              <p className="font-medium capitalize">Team Account</p>
            </div>
          </div>
          <p className="text-xs text-ink-2">
            Share these credentials with the team. They can log in at the login page.
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <SkeletonList items={4} />
        </div>
      ) : accounts.length === 0 ? (
        <div className="panel p-12 text-center text-ink-2">
          <UserCog size={48} className="mx-auto mb-4 text-ink-3/40" />
          <p className="text-lg font-medium">No team accounts yet</p>
          <p className="text-sm mt-1">Create accounts so teams can log in independently.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <div key={account.id} className="card p-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center shrink-0">
                  <UserCog size={18} className="text-muted" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{account.display_name}</p>
                  <p className="text-xs text-muted font-mono truncate">{account.username}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 min-w-0">
                <div className="text-right text-xs text-muted min-w-0">
                  <p className="truncate max-w-[140px]">{account.teams?.name || "—"}</p>
                  <p>{new Date(account.created_at).toLocaleDateString()}</p>
                </div>
                <button
                  onClick={() => handleDelete(account)}
                  disabled={deletingId === account.id}
                  className="btn-ghost text-xs text-danger"
                  title="Delete account"
                >
                  {deletingId === account.id ? (
                    <span className="block w-3 h-3 bg-surface-2 rounded animate-pulse" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
