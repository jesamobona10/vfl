"use client";

import { useState, useEffect, useCallback } from "react";
import { titleCase } from "@/lib/utils/helpers";

interface AuditLog {
  id: number;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function activityText(log: AuditLog): string {
  const label = titleCase(log.event_type).replace(/_/g, " ");
  const meta = log.metadata ?? {};
  const names: string[] = [];
  if (meta.team_name) names.push(String(meta.team_name));
  if (meta.org_name) names.push(String(meta.org_name));
  if (meta.count && meta.count !== 1) names.push(`${meta.count} players`);
  const detail = names.length ? ` — ${names.join(", ")}` : "";
  return `${label}${detail}`;
}

export function RecentActivity({ orgSlug }: { orgSlug: string }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/org/${orgSlug}/audit-logs?limit=4`);
      const data = await res.json();
      if (res.ok) setLogs(data.logs || []);
    } catch {
      // ignore — activity feed is best-effort
    }
  }, [orgSlug]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  if (!logs.length) {
    return (
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Recent activity</span>
        </div>
        <p className="text-sm text-ink-2 text-center py-6">No activity yet.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">Recent activity</span>
      </div>
      <div>
        {logs.map((log) => (
          <div key={log.id} className="activity-item">
            <span className="w-1.5 h-1.5 rounded-full bg-gold-500 mt-1.5 shrink-0" />
            <div className="min-w-0">
              <div className="text-[12.5px] leading-snug">{activityText(log)}</div>
              <div className="text-xs text-ink-3 mt-0.5">{relativeTime(log.created_at)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
