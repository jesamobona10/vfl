"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, Loader2, AlertCircle, KeyRound, Users } from "lucide-react";

export function UsersManager() {
  const [tab, setTab] = useState<"admins" | "teams" | "players">("admins");

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Users & Accounts</h3>

      <div className="flex gap-1 bg-surface-2 rounded-lg p-1 w-fit">
        {([["admins", "Admin Users"], ["teams", "Team Accounts"], ["players", "Player Credentials"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === key ? "bg-surface shadow-sm" : "text-muted hover:text-text"}`}>
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
      .then((d) => { if (d.stats) setAdminCount(d.stats.adminUsers); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-muted" /></div>;

  return (
    <div className="card p-4 space-y-3">
      <p className="text-sm text-muted">Super admin users listed in the <code className="bg-surface-2 px-1 rounded">admin_users</code> table have unrestricted access to the entire system.</p>
      <p className="text-xs text-muted">Current count: {adminCount ?? 0} admin user(s). Add/remove via your Supabase dashboard.</p>
    </div>
  );
}

function TeamAccountsList() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/team-accounts")
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-muted" /></div>;

  return (
    <div className="space-y-2">
      {accounts.length === 0 ? (
        <p className="text-sm text-muted text-center py-8">No team accounts created yet.</p>
      ) : (
        accounts.map((a: any) => (
          <div key={a.id} className="card px-4 py-2.5 flex items-center gap-3 text-sm">
            <KeyRound size={16} className="text-muted shrink-0" />
            <span className="font-medium">{a.username}</span>
            <span className="text-xs text-muted">{a.teams?.name || "—"}</span>
            <span className="text-xs text-muted ml-auto">{new Date(a.created_at).toLocaleDateString()}</span>
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

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-muted" /></div>;

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">Generate player credentials through the Players tab. History of past generations:</p>
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
