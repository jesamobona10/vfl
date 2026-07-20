"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, Loader2, AlertCircle } from "lucide-react";

interface AuditLog {
  id: number;
  user_id: string;
  event_type: string;
  ip_address: string;
  user_agent: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface CredentialLog {
  id: number;
  generated_by: string;
  team_id: number;
  scope: string;
  players_affected: number;
  created_at: string;
}

export function AuditViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [credLogs, setCredLogs] = useState<CredentialLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [eventFilter, setEventFilter] = useState("");

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (eventFilter) params.set("event_type", eventFilter);
      const res = await fetch(`/api/admin/audit-logs?${params}`);
      const data = await res.json();
      if (res.ok) { setLogs(data.logs || []); setCredLogs(data.credentialLogs || []); }
      else setError(data.error || "Failed to load logs");
    } catch { setError("Failed to load audit logs."); }
    finally { setLoading(false); }
  }, [eventFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-muted" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold mb-1">Audit Logs</h3>
        <p className="text-sm text-muted">Security events and credential generation history.</p>
      </div>

      <div className="flex items-center gap-2">
        <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} className="input text-sm w-auto">
          <option value="">All Events</option>
          <option value="login">Login</option>
          <option value="logout">Logout</option>
          <option value="join_org">Join Org</option>
          <option value="create_org">Create Org</option>
          <option value="invite_player">Invite Player</option>
          <option value="transfer_player">Transfer Player</option>
        </select>
        <span className="text-xs text-muted">{logs.length} event(s)</span>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-4 py-3">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {logs.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-muted uppercase mb-2">Security Events</h4>
          <div className="space-y-1">
            {logs.map((log) => (
              <div key={log.id} className="card px-4 py-2 flex items-center gap-3 text-xs">
                <Shield size={14} className="text-muted shrink-0" />
                <span className="font-mono text-muted w-32 truncate">{log.user_id}</span>
                <span className="font-medium w-28">{log.event_type}</span>
                <span className="text-muted w-24">{new Date(log.created_at).toLocaleString()}</span>
                <span className="text-muted w-20">{log.ip_address || "—"}</span>
                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <span className="text-muted truncate">{JSON.stringify(log.metadata)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {credLogs.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-muted uppercase mb-2">Credential Generation</h4>
          <div className="space-y-1">
            {credLogs.map((log) => (
              <div key={log.id} className="card px-4 py-2 flex items-center gap-3 text-xs">
                <span className="font-mono text-muted w-32 truncate">{log.generated_by}</span>
                <span className="text-muted">Team #{log.team_id}</span>
                <span className="text-muted capitalize">{log.scope}</span>
                <span className="text-muted">{log.players_affected} player(s)</span>
                <span className="text-muted">{new Date(log.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {logs.length === 0 && credLogs.length === 0 && (
        <p className="text-sm text-muted text-center py-8">No audit logs found.</p>
      )}
    </div>
  );
}
