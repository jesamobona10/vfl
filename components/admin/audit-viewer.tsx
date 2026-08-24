"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, AlertCircle, ChevronLeft, ChevronRight, X } from "lucide-react";
import { SkeletonList } from "@/components/shared/skeleton";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { titleCase } from "@/lib/utils/helpers";

interface AuditActor {
  label: string;
  role?: string | null;
}

interface AuditLog {
  id: number;
  user_id: string;
  action: string;
  label?: string;
  actor_role?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  description?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  success?: boolean;
  severity?: string | null;
  category?: string | null;
  ip_address?: string | null;
  created_at: string;
  actor?: AuditActor | null;
}

interface CredentialLog {
  id: number;
  generated_by: string;
  team_id: number;
  scope: string;
  players_affected: number;
  created_at: string;
}

const ACTION_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All Actions" },
  { value: AUDIT_ACTIONS.LOGIN_SUCCESS, label: "Login Succeeded" },
  { value: AUDIT_ACTIONS.LOGIN_FAILED, label: "Login Failed" },
  { value: AUDIT_ACTIONS.MATCH_SCORE_UPDATED, label: "Score Updated" },
  { value: AUDIT_ACTIONS.MATCH_STARTED, label: "Match Started" },
  { value: AUDIT_ACTIONS.FIXTURES_GENERATED, label: "Fixtures Generated" },
  { value: AUDIT_ACTIONS.TEAM_CREATED, label: "Team Created" },
  { value: AUDIT_ACTIONS.PLAYER_CREATED, label: "Player Created" },
  { value: AUDIT_ACTIONS.PLAYER_UPDATED, label: "Player Updated" },
  { value: AUDIT_ACTIONS.USER_CREATED, label: "User Created" },
  { value: AUDIT_ACTIONS.ROLE_CHANGED, label: "Role Changed" },
  { value: AUDIT_ACTIONS.PASSWORD_CHANGED, label: "Password Changed" },
];

const SEVERITY_STYLES: Record<string, string> = {
  LOW: "bg-black/10 text-black/50",
  MEDIUM: "bg-amber-100 text-amber-700",
  HIGH: "bg-red-100 text-red-700",
  CRITICAL: "bg-red-600 text-white",
};

function ChangesList({
  before,
  after,
}: {
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}) {
  const keys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})]));
  return (
    <div className="space-y-2">
      {keys.map((key) => {
        const b = before?.[key];
        const a = after?.[key];
        const render = (v: unknown) =>
          v === null || v === undefined
            ? "—"
            : typeof v === "object"
              ? JSON.stringify(v)
              : String(v);
        return (
          <div key={key} className="text-xs border-b border-line pb-2">
            <div className="font-medium capitalize mb-1">{titleCase(key.replace(/_/g, " "))}</div>
            <div className="flex justify-between gap-4">
              <span className="text-ink-3">Before: {render(b)}</span>
              <span className="text-ink-1">After: {render(a)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AuditRow({ log }: { log: AuditLog }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="card px-4 py-2.5 flex items-center gap-3 text-xs cursor-pointer hover:bg-surface-2/40 w-full text-left"
        onClick={() => setOpen(true)}
      >
        <Shield size={14} className="text-muted shrink-0" />
        <span className="font-medium w-44 truncate">
          {log.actor?.label || log.actor_role || "Unknown"}
        </span>
        <span className="font-medium w-36">{log.label || log.action}</span>
        <span className="text-muted w-40 truncate">{log.description || "—"}</span>
        <span className="text-muted w-24">
          {new Date(log.created_at).toLocaleDateString()}{" "}
          {new Date(log.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${
            SEVERITY_STYLES[log.severity || "LOW"] || SEVERITY_STYLES.LOW
          }`}
        >
          {log.severity || "LOW"}
        </span>
      </button>
      {open && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={log.label || log.action}
            className="absolute right-0 top-0 h-full w-full max-w-md bg-surface shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <div>
                <div className="text-xs uppercase tracking-wide text-ink-3">Audit Event</div>
                <h3 className="text-lg font-bold">{log.label || log.action}</h3>
              </div>
              <button className="btn-icon" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="text-sm font-semibold">
                {log.actor?.label || log.actor_role || "Unknown user"}
              </div>
              <div className="text-xs">
                <span className="text-ink-3">Date </span>
                {new Date(log.created_at).toLocaleString()}
              </div>
              {log.description && <div className="text-xs">{log.description}</div>}
              {(log.resource_type || log.resource_id) && (
                <div className="text-xs">
                  <span className="text-ink-3">Resource </span>
                  {log.resource_type?.toLowerCase()}
                  {log.resource_id && <span className="ml-1 font-mono">#{log.resource_id}</span>}
                </div>
              )}
              {(log.before || log.after) && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-ink-3 mb-1.5">
                    Changes
                  </div>
                  <ChangesList before={log.before} after={log.after} />
                </div>
              )}
              {log.metadata && Object.keys(log.metadata).length > 0 && (
                <pre className="text-xs bg-bg border border-line rounded-lg p-3 overflow-x-auto">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              )}
              <div className="text-xs text-ink-3">
                IP {log.ip_address || "—"} · {log.user_id}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function AuditViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [credLogs, setCredLogs] = useState<CredentialLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const pages = Math.max(1, Math.ceil(total / limit));

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (actionFilter) params.set("action", actionFilter);
      const res = await fetch(`/api/admin/audit-logs?${params}`);
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs || []);
        setCredLogs(data.credentialLogs || []);
        setTotal(data.total || 0);
      } else {
        setError(data.error || "Failed to load logs");
      }
    } catch {
      setError("Failed to load audit logs.");
    } finally {
      setLoading(false);
    }
  }, [page, limit, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setPage(1);
  }, [actionFilter]);

  if (loading) return <SkeletonList items={4} />;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold mb-1">Audit Logs</h3>
        <p className="text-sm text-muted">
          Global security and data events across all organizations.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="input text-sm w-auto"
        >
          {ACTION_FILTERS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted">{total.toLocaleString()} event(s)</span>
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
              <AuditRow key={log.id} log={log} />
            ))}
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-ghost text-sm"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <span className="text-xs text-muted">
                Page {page} of {pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="btn-ghost text-sm"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {credLogs.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-muted uppercase mb-2">Credential Generation</h4>
          <div className="space-y-1">
            {credLogs.map((log) => (
              <div key={log.id} className="card px-4 py-2.5 flex items-center gap-3 text-xs">
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
