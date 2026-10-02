"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createPublicClient } from "@/lib/supabase/public";
import type { PublicMatchRow } from "@/lib/types";
import { PushSubscriptionControl } from "@/components/public/push-subscription";

type MatchFilter = "all" | "scheduled" | "live" | "completed";

const FILTERS: Array<{ key: MatchFilter; label: string }> = [
  { key: "all", label: "All matches" },
  { key: "scheduled", label: "Scheduled" },
  { key: "live", label: "Live" },
  { key: "completed", label: "Full-time" },
];

function matchCategory(status: string): Exclude<MatchFilter, "all"> {
  if (status === "live" || status === "in-progress") return "live";
  if (status === "completed") return "completed";
  return "scheduled";
}

function statusLabel(status: string) {
  const category = matchCategory(status);
  if (category === "live") return "LIVE";
  if (category === "completed") return "FULL-TIME";
  return "SCHEDULED";
}

function statusBadgeClass(status: string) {
  const category = matchCategory(status);
  if (category === "live") {
    return "bg-danger/15 text-danger border-danger/30 animate-pulse";
  }
  if (category === "completed") return "bg-surface-2 text-muted border-line";
  return "bg-brand/10 text-brand border-brand/20";
}

function fmtDateTime(date: string | null, time: string | null) {
  return [date, time].filter(Boolean).join(" · ");
}

export default function PublicIndexPage() {
  const [matches, setMatches] = useState<PublicMatchRow[]>([]);
  const [filter, setFilter] = useState<MatchFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = createPublicClient();
    let mounted = true;

    async function load() {
      const { data, error } = await sb
        .from("public_matches")
        .select("*")
        .order("date", { ascending: false, nullsFirst: false })
        .order("time", { ascending: true, nullsFirst: false })
        .order("round", { ascending: true })
        .order("match_id", { ascending: true });

      if (!mounted) return;
      if (error) {
        setError(error.message);
      } else {
        setMatches((data as PublicMatchRow[]) || []);
        setError(null);
      }
      setLoading(false);
    }

    load();

    const channel = sb
      .channel("public-matches")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fixtures" },
        () => {
          if (mounted) load();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_events" },
        () => {
          if (mounted) load();
        }
      )
      .subscribe();

    const poll = setInterval(() => {
      if (mounted) load();
    }, 20000);

    return () => {
      mounted = false;
      clearInterval(poll);
      try {
        sb.removeChannel(channel);
      } catch {}
    };
  }, []);

  const counts = useMemo(() => {
    const result: Record<MatchFilter, number> = {
      all: matches.length,
      scheduled: 0,
      live: 0,
      completed: 0,
    };
    for (const match of matches) result[matchCategory(match.status)] += 1;
    return result;
  }, [matches]);

  const visibleMatches = useMemo(() => {
    const selected =
      filter === "all"
        ? matches
        : matches.filter((match) => matchCategory(match.status) === filter);

    return [...selected].sort((a, b) => {
      const rank = (match: PublicMatchRow) =>
        matchCategory(match.status) === "live"
          ? 0
          : matchCategory(match.status) === "scheduled"
            ? 1
            : 2;
      const statusOrder = rank(a) - rank(b);
      if (statusOrder !== 0) return statusOrder;
      if (matchCategory(a.status) === "completed") {
        return (b.date || "").localeCompare(a.date || "");
      }
      return `${a.date || ""} ${a.time || ""}`.localeCompare(`${b.date || ""} ${b.time || ""}`);
    });
  }, [filter, matches]);

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold">Matches</h1>
        <p className="text-sm text-ink-3">Scheduled fixtures, live scores, and full-time results</p>
      </div>

      <PushSubscriptionControl />

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter matches">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === key
                ? "border-brand bg-brand text-white"
                : "border-line bg-surface text-ink-3 hover:bg-surface-2"
            }`}
          >
            {label} <span className="ml-1 opacity-75">{counts[key]}</span>
          </button>
        ))}
      </div>

      {loading && <div className="text-sm text-muted">Loading matches...</div>}
      {error && <div className="text-sm text-danger">{error}</div>}

      {!loading && !error && visibleMatches.length > 0 && (
        <div className="space-y-3">
          {visibleMatches.map((match) => {
            const category = matchCategory(match.status);
            const card = (
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusBadgeClass(match.status)}`}
                  >
                    {statusLabel(match.status)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 truncate text-sm font-medium sm:text-base">
                      {match.home_team_logo && (
                        <Image src={match.home_team_logo} alt="" width={20} height={20} className="h-5 w-5 shrink-0 rounded-full object-cover" />
                      )}
                      <span className="truncate">{match.home_team_name} vs {match.away_team_name}</span>
                      {match.away_team_logo && (
                        <Image src={match.away_team_logo} alt="" width={20} height={20} className="h-5 w-5 shrink-0 rounded-full object-cover" />
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-3">
                      Round {match.round}
                      {fmtDateTime(match.date, match.time)
                        ? ` · ${fmtDateTime(match.date, match.time)}`
                        : ""}
                      {match.venue ? ` · ${match.venue}` : ""}
                    </div>
                  </div>
                </div>
                {category !== "scheduled" && (
                  <span className="shrink-0 text-lg font-bold tabular-nums sm:text-xl">
                    {match.home_score ?? 0} — {match.away_score ?? 0}
                  </span>
                )}
              </div>
            );

            return category === "live" ? (
              <Link
                key={match.match_id}
                href={`/public/live/${match.match_id}`}
                className="card block p-4 transition-colors hover:bg-surface-2/40"
              >
                {card}
              </Link>
            ) : (
              <div key={match.match_id} className="card p-4">
                {card}
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && visibleMatches.length === 0 && (
        <div className="card p-6 text-center text-sm text-muted">
          {filter === "all"
            ? "No matches available right now."
            : `No ${filter === "completed" ? "full-time" : filter} matches available right now.`}
        </div>
      )}
    </div>
  );
}
