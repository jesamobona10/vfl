"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useOrg } from "@/lib/hooks/use-org";
import { ScrollText, AlertCircle, Shield } from "lucide-react";
import { SkeletonList } from "@/components/shared/skeleton";

interface AuditLog {
  id: number;
  user_id: string;
  event_type: string;
  ip_address: string;
  user_agent: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export default function OrgAuditLogsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { data: currentOrg } = useOrg(slug);

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [eventFilter, setEventFilter] = useState("");

  const fetchLogs = useCallback(async () => {
    if (!currentOrg?.id) return;
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (eventFilter) query.set("event_type", eventFilter);
      const res = await fetch(`/api/org/${slug}/audit-logs?${query}`);
      const data = await res.json();
      if (res.ok) setLogs(data.logs || []);
      else setError(data.error || "Failed to load logs");
    } catch {
      setError("Failed to load audit logs.");
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id, slug, eventFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  if (loading) return <SkeletonList items={4} />;

  return (
    <div className="space-y-5">
      <div className="page-head">
        <div>
          <p className="page-title">Audit Logs</p>
          <p className="page-sub">Security events within your organization.</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className="input text-sm w-auto"
        >
          <option value="">All Events</option>
          <option value="org_login_succeeded">Login</option>
          <option value="logout">Logout</option>
          <option value="org_member_invited">Member Invited</option>
          <option value="org_member_removed">Member Removed</option>
          <option value="org_team_account_created">Team Account Created</option>
          <option value="org_team_account_password_reset">Password Reset</option>
          <option value="team_account_deactivated">Account Deactivated</option>
        </select>
        <span className="text-xs text-muted">{logs.length} event(s)</span>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-4 py-3">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {logs.length > 0 ? (
        <div className="panel">
          {logs.map((log) => (
            <div key={log.id} className="activity-item">
              <Shield size={13} className="text-ink-3 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium text-[12.5px]">{log.event_type}</span>
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <span className="text-[11px] text-ink-3 truncate">
                      {JSON.stringify(log.metadata)}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-ink-3 mt-0.5">
                  {new Date(log.created_at).toLocaleString()}
                  {" · "}
                  {log.ip_address || "\u2014"}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-2 text-center py-8">No audit logs found for this organization.</p>
      )}
    </div>
  );
}
