"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Image as ImageIcon, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";

type AttentionTask = {
  id: string;
  type: "fixture_details" | "lineup_review" | "media_review";
  severity: "warning" | "info";
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  fixtureId: number;
  dueAt?: string;
};

function taskIcon(type: AttentionTask["type"]) {
  if (type === "lineup_review") return ShieldCheck;
  if (type === "media_review") return ImageIcon;
  return AlertTriangle;
}

function formatKickoff(value: string, timezone: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
    }).format(new Date(value));
  } catch {
    return new Date(value).toISOString();
  }
}

export function NeedsAttention({ slug, orgSeasonId }: { slug: string; orgSeasonId: string | null }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["organization-attention", slug, orgSeasonId],
    enabled: Boolean(orgSeasonId),
    staleTime: 30_000,
    queryFn: async () => {
      const response = await fetch(
        `/api/organizations/${encodeURIComponent(slug)}/attention?org_season_id=${encodeURIComponent(orgSeasonId!)}`,
        { cache: "no-store" }
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load tasks.");
      return {
        tasks: Array.isArray(body.tasks) ? body.tasks as AttentionTask[] : [],
        timezone: typeof body.timezone === "string" ? body.timezone : "Africa/Lagos",
      };
    },
  });
  const tasks = data?.tasks ?? [];
  const timezone = data?.timezone ?? "Africa/Lagos";
  const loading = Boolean(orgSeasonId) && isLoading;
  const errorMessage = error instanceof Error ? error.message : error ? "Unable to load tasks." : null;

  return (
    <section aria-labelledby="needs-attention-heading" className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
        <div>
          <h2 id="needs-attention-heading" className="text-base font-semibold">Needs attention</h2>
          <p className="mt-0.5 text-xs text-ink-3">Work to resolve for the selected organization season.</p>
        </div>
        {!loading && !error && <span className="rounded-full bg-warn-500/10 px-2.5 py-1 text-xs font-semibold text-warn-700">{tasks.length} open</span>}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 px-5 py-8 text-sm text-ink-3"><LoaderCircle size={16} className="animate-spin" /> Loading operational tasks…</div>
      ) : errorMessage ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5" role="alert">
          <p className="text-sm text-danger">{errorMessage}</p>
          <button type="button" onClick={() => void refetch()} className="btn-secondary inline-flex items-center gap-2 px-3 py-2 text-xs"><RefreshCw size={14} /> Retry</button>
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex items-start gap-3 px-5 py-6">
          <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-brand" />
          <div><p className="text-sm font-medium">{orgSeasonId ? "You’re all caught up" : "No season selected"}</p><p className="mt-1 text-xs text-ink-3">{orgSeasonId ? "No fixture details, lineups or media need review for this season." : "Create an organization season to see operational tasks here."}</p></div>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {tasks.map((task) => {
            const Icon = taskIcon(task.type);
            return (
              <li key={task.id}>
                <Link href={task.href} className="group flex min-w-0 items-start gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2/50 sm:px-5">
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${task.severity === "warning" ? "bg-warn-500/10 text-warn-700" : "bg-brand/10 text-brand"}`}><Icon size={17} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{task.title}</span>
                    <span className="mt-0.5 block text-xs text-ink-3">{task.description}</span>
                    {task.dueAt && <time dateTime={task.dueAt} className="mt-1 block text-[11px] text-ink-3">Kickoff {formatKickoff(task.dueAt, timezone)}</time>}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 self-center text-xs font-semibold text-brand">{task.actionLabel}<ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" /></span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
