"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useOrg } from "@/lib/hooks/use-org";
import {
  ScrollText,
  AlertCircle,
  Shield,
  ChevronDown,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { SkeletonTable } from "@/components/shared/skeleton";
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
  metadata?: Record<string, unknown>;
  success?: boolean;
  category?: string | null;
  severity?: string | null;
  ip_address?: string | null;
  created_at: string;
  actor?: AuditActor | null;
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
  LOW: "bg-surface-2 text-ink-3",
  MEDIUM: "bg-gold-tint text-gold-700",
  HIGH: "bg-danger/10 text-danger",
  CRITICAL: "bg-danger text-white",
};

function severityBadge(severity?: string | null) {
  const s = severity || "LOW";
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${
        SEVERITY_STYLES[s] || SEVERITY_STYLES.LOW
      }`}
    >
      {s}
    </span>
  );
}

function renderChange(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function humanizeKey(key: string): string {
  const map: Record<string, string> = {
    homeScore: "Home Score",
    awayScore: "Away Score",
    teamId: "Team",
    team_id: "Team",
    jersey_number: "Jersey Number",
    is_captain: "Captain",
    status: "Status",
    name: "Name",
    position: "Position",
    username: "Username",
    email: "Email",
    role: "Role",
    live_started_at: "Kickoff (Live)",
  };
  return map[key] || titleCase(key.replace(/_/g, " "));
}

function ChangesList({
  before,
  after,
}: {
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}) {
  if (!before && !after) {
    return <p className="text-sm text-ink-2 py-2">No change details recorded.</p>;
  }

  const keys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})]));

  return (
    <div className="space-y-2.5">
      {keys.map((key) => {
        const b = before?.[key];
        const a = after?.[key];
        const changed = JSON.stringify(b ?? null) !== JSON.stringify(a ?? null);
        return (
          <div
            key={key}
            className="flex items-start gap-3 text-sm rounded-lg border border-line px-3 py-2"
          >
            <span className="font-medium w-32 shrink-0 pt-0.5">{humanizeKey(key)}</span>
            <div className="flex-1 grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-ink-3 mb-0.5">Before</div>
                <div className={changed ? "text-ink-2" : "text-ink-3"}>{renderChange(key, b)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-ink-3 mb-0.5">After</div>
                <div className={changed ? "font-semibold text-text" : "text-ink-3"}>
                  {renderChange(key, a)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function OrgAuditLogsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const { data: currentOrg } = useOrg(slug);

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const actorFilter = searchParams.get("actor_id") || "";
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const pages = Math.max(1, Math.ceil(total / limit));

  const fetchLogs = useCallback(async () => {
    if (!currentOrg?.id) return;
    setLoading(true);
    try {
      const query = new URLSearchParams();
      query.set("page", String(page));
      query.set("limit", String(limit));
      if (actionFilter) query.set("action", actionFilter);
      if (resourceFilter) query.set("resource_type", resourceFilter);
      if (actorFilter) query.set("actor_id", actorFilter);
      const res = await fetch(`/api/org/${slug}/audit-logs?${query}`);
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      } else {
        setError(data.error || "Failed to load logs");
      }
    } catch {
      setError("Failed to load audit logs.");
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id, slug, page, limit, actionFilter, resourceFilter, actorFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setPage(1);
  }, [actionFilter, resourceFilter, actorFilter]);

  const resultsLabel = useMemo(
    () =>
      total === 0
        ? "0 events"
        : `${Math.min((page - 1) * limit + 1, total)}–${Math.min(page * limit, total)} of ${total}`,
    [total, page, limit]
  );

  if (loading) return <SkeletonTable rows={6} cols={5} />;

  return (
    <div className="space-y-5">
      <div className="page-head">
        <div>
          <p className="page-title">Audit Logs</p>
          <p className="page-sub">Monitor important activities within your organization.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-ink-2 whitespace-nowrap">Action</label>
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
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-ink-2 whitespace-nowrap">Resource</label>
          <select
            value={resourceFilter}
            onChange={(e) => setResourceFilter(e.target.value)}
            className="input text-sm w-auto"
          >
            <option value="">All Resources</option>
            <option value="MATCH">Match</option>
            <option value="PLAYER">Player</option>
            <option value="TEAM">Team</option>
            <option value="FIXTURES">Fixtures</option>
            <option value="TEAM_ACCOUNT">Team Account</option>
            <option value="ORG_MEMBER">Org Member</option>
            <option value="AUTH">Auth</option>
          </select>
        </div>
        {(actionFilter || resourceFilter || actorFilter) && (
          <button
            onClick={() => {
              setActionFilter("");
              setResourceFilter("");
              window.history.replaceState(null, "", `/org/${slug}/audit-logs`);
            }}
            className="btn-ghost text-sm"
          >
            <X size={14} /> Clear filters
          </button>
        )}
        <span className="text-xs text-ink-3 ml-auto">{resultsLabel}</span>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-4 py-3">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {logs.length > 0 ? (
        <div className="panel overflow-visible">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.04em] text-ink-3 font-semibold">
                  <th className="px-4 py-2.5 font-semibold border-b border-line">Date</th>
                  <th className="px-4 py-2.5 font-semibold border-b border-line">User</th>
                  <th className="px-4 py-2.5 font-semibold border-b border-line">Action</th>
                  <th className="px-4 py-2.5 font-semibold border-b border-line">Resource</th>
                  <th className="px-4 py-2.5 font-semibold border-b border-line text-center">
                    Severity
                  </th>
                  <th className="px-4 py-2.5 font-semibold border-b border-line text-right">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelected(log)}
                    className="border-b border-line/50 last:border-0 hover:bg-surface-2/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2.5 text-ink-2 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleDateString()} ·{" "}
                      {new Date(log.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-medium">
                        {log.actor?.label || log.actor_role || "Unknown"}
                      </span>
                      {log.actor?.role && (
                        <span className="block text-xs text-ink-3 capitalize">
                          {log.actor.role.replace(/_/g, " ")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5">
                        <Shield size={13} className="text-ink-3 shrink-0" />
                        <span className="font-medium">{log.label || log.action}</span>
                      </span>
                      {log.description && (
                        <span className="block text-xs text-ink-2 truncate max-w-[240px]">
                          {log.description}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[12px] uppercase tracking-wide text-ink-2">
                        {log.resource_type?.toLowerCase() || "—"}
                      </span>
                      {log.resource_id && (
                        <span className="block text-xs text-ink-3 font-mono">
                          #{log.resource_id}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">{severityBadge(log.severity)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        className="btn-ghost text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(log);
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-line">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-ghost text-sm"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <span className="text-xs text-ink-3">
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
      ) : (
        <div className="panel p-8 text-center text-ink-2">
          <ScrollText size={32} className="mx-auto text-ink-3/40 mb-3" />
          <p>No audit events found.</p>
          <p className="text-sm text-ink-3 mt-1">
            Try clearing the filters or check back after some activity.
          </p>
        </div>
      )}

      {selected && <AuditDetailDrawer log={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function AuditDetailDrawer({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
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
          <button onClick={onClose} className="btn-icon" title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center shrink-0">
              <Shield size={18} className="text-ink-3" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">
                {log.actor?.label || log.actor_role || "Unknown user"}
              </div>
              <div className="text-xs text-ink-3 capitalize">
                {log.actor?.role?.replace(/_/g, " ") ||
                  (log.actor_role || "").replace(/_/g, " ") ||
                  "—"}
              </div>
            </div>
            {severityBadge(log.severity)}
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-ink-3 mb-1.5">Date</div>
            <div className="text-sm">
              {new Date(log.created_at).toLocaleString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-ink-3 mb-1.5">Description</div>
            <div className="text-sm">{log.description || "No description recorded."}</div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-ink-3 mb-1.5">Resource</div>
            <div className="text-sm">
              <span className="uppercase text-xs font-semibold tracking-wide">
                {log.resource_type?.toLowerCase() || "—"}
              </span>
              {log.resource_id && <span className="ml-2 font-mono">#{log.resource_id}</span>}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-ink-3 mb-1.5">Changes</div>
            <ChangesList before={log.before} after={log.after} />
          </div>

          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-ink-3 mb-1.5">Metadata</div>
              <pre className="text-xs bg-bg border border-line rounded-lg p-3 overflow-x-auto">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-line text-xs text-ink-3">
            <span>IP {log.ip_address || "—"}</span>
            <span className="capitalize">{log.category?.toLowerCase() || "system"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
