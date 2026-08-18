"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, AlertCircle, KeyRound, Users, Trash2 } from "lucide-react";
import { SkeletonList } from "@/components/shared/skeleton";

export function UsersManager() {
  const [tab, setTab] = useState<"admins" | "teams" | "players">("admins");

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Users & Accounts</h3>

      <div className="flex gap-1 bg-surface-2 rounded-lg p-1 w-fit">
        {(
          [
            ["admins", "Admin Users"],
            ["teams", "Team Accounts"],
            ["players", "Player Credentials"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === key ? "bg-surface shadow-sm" : "text-muted hover:text-text"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "admins" && <AdminUsersList />}
      {tab === "teams" && <TeamAccountsList />}
      {tab === "players" && <PlayerCredsList />}
    </div>
  );
}

function AdminUsersList() {
  const [adminCount, setAdminCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((d) => {
        if (d.stats) setAdminCount(d.stats.adminUsers);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonList items={3} />;

  return (
    <div className="card p-4 space-y-3">
      <p className="text-sm text-muted">
        Super admin users listed in the{" "}
        <code className="bg-surface-2 px-1 rounded">admin_users</code> table have unrestricted
        access to the entire system.
      </p>
      <p className="text-xs text-muted">
        Current count: {adminCount ?? 0} admin user(s). Add/remove via your Supabase dashboard.
      </p>
    </div>
  );
}

function TeamAccountsList() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchAccounts = useCallback(() => {
    fetch("/api/admin/team-accounts")
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleDelete = async (a: any) => {
    if (!confirm(`Delete team account "${a.username}"? This CANNOT be undone.`)) return;
    setError("");
    setDeletingId(a.id);
    try {
      const res = await fetch(`/api/admin/team-accounts/${a.id}`, { method: "DELETE" });
      const d = await res.json();
      if (d.error) {
        setError(d.error);
        return;
      }
      fetchAccounts();
    } catch {
      setError("Failed to delete account.");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <SkeletonList items={3} />;

  return (
    <div className="space-y-2">
      {error && (
        <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-4 py-3">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {accounts.length === 0 ? (
        <p className="text-sm text-muted text-center py-8">No team accounts created yet.</p>
      ) : (
        accounts.map((a: any) => (
          <div key={a.id} className="card px-4 py-2.5 flex items-center gap-3 text-sm">
            <KeyRound size={16} className="text-muted shrink-0" />
            <span className="font-medium">{a.username}</span>
            <span className="text-xs text-muted">{a.teams?.name || "—"}</span>
            <span className="text-xs text-muted ml-auto">
              {new Date(a.created_at).toLocaleDateString()}
            </span>
            <button
              onClick={() => handleDelete(a)}
              disabled={deletingId === a.id}
              className="btn-ghost text-xs text-danger"
              title="Delete account"
            >
              {deletingId === a.id ? (
                <span className="block w-3 h-3 bg-surface-2 rounded animate-pulse" />
              ) : (
                <Trash2 size={13} />
              )}
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function PlayerCredsList() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/audit-logs?limit=20")
      .then((r) => r.json())
      .then((d) => setLogs(d.credentialLogs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonList items={3} />;

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">
        Generate player credentials through the Players tab. History of past generations:
      </p>
      {logs.length === 0 ? (
        <p className="text-sm text-muted text-center py-8">No credentials generated yet.</p>
      ) : (
        logs.map((log: any) => (
          <div key={log.id} className="card px-4 py-2 flex items-center gap-3 text-xs">
            <Users size={14} className="text-muted shrink-0" />
            <span className="text-muted">Team #{log.team_id}</span>
            <span className="text-muted capitalize">{log.scope}</span>
            <span className="text-muted">{log.players_affected} player(s)</span>
            <span className="text-muted ml-auto">{new Date(log.created_at).toLocaleString()}</span>
          </div>
        ))
      )}
    </div>
  );
}
