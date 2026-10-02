"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CalendarClock, MapPin, Radio } from "lucide-react";
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
  if (!date && !time) return "Date to be announced";
  const readableDate = date
    ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;
  return [readableDate, time].filter(Boolean).join(" · ");
}

function TeamLogo({ name, logo }: { name: string; logo: string | null }) {
  return logo ? (
    <Image src={logo} alt="" width={48} height={48} className="h-11 w-11 rounded-full border border-line bg-surface-2 object-cover sm:h-12 sm:w-12" />
  ) : (
    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface-2 text-base font-bold text-ink-3 sm:h-12 sm:w-12">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
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
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <header className="overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-surface via-surface to-brand/5 p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand">
              <Radio size={12} /> Match centre
            </span>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Matches</h1>
            <p className="mt-1 text-sm text-ink-3">Fixtures, live action, and final scores in one place.</p>
          </div>
          <div className="hidden rounded-xl border border-line bg-surface/80 px-4 py-3 text-right sm:block">
            <p className="text-2xl font-bold tabular-nums">{counts.live}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">Live now</p>
          </div>
        </div>
      </header>

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
                : "border-line bg-surface text-ink-3 hover:border-brand/30 hover:bg-surface-2"
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
            const isScheduled = category === "scheduled";
            return (
              <Link
                key={match.match_id}
                href={`/public/live/${match.match_id}`}
                className={`group card block overflow-hidden p-4 transition-all hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-lg sm:p-5 ${
                  category === "live" ? "border-danger/20" : ""
                }`}
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wide ${statusBadgeClass(match.status)}`}>
                    {category === "live" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
                    {statusLabel(match.status)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-ink-3">
                    <CalendarClock size={13} />
                    <span>Round {match.round} · {fmtDateTime(match.date, match.time)}</span>
                  </span>
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
                  <div className="flex min-w-0 flex-col items-center gap-2 text-center sm:flex-row sm:justify-end sm:text-right">
                    <TeamLogo name={match.home_team_name} logo={match.home_team_logo || null} />
                    <span className="w-full truncate text-xs font-semibold sm:w-auto sm:text-sm">{match.home_team_name}</span>
                  </div>
                  <div className="min-w-[72px] text-center">
                    <p className={`font-bold tabular-nums ${isScheduled ? "text-sm uppercase tracking-widest text-ink-3" : "text-2xl sm:text-3xl"}`}>
                      {isScheduled ? "VS" : `${match.home_score ?? 0} — ${match.away_score ?? 0}`}
                    </p>
                    {isScheduled && match.time && <p className="mt-1 text-[10px] font-medium text-ink-3">{match.time}</p>}
                  </div>
                  <div className="flex min-w-0 flex-col items-center gap-2 text-center sm:flex-row sm:justify-start sm:text-left">
                    <TeamLogo name={match.away_team_name} logo={match.away_team_logo || null} />
                    <span className="w-full truncate text-xs font-semibold sm:w-auto sm:text-sm">{match.away_team_name}</span>
                  </div>
                </div>

                <div className="mt-4 flex min-h-5 items-center justify-between border-t border-line/70 pt-3 text-xs text-ink-3">
                  <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
                    {match.venue ? <><MapPin size={13} className="shrink-0" />{match.venue}</> : "Match details"}
                  </span>
                  <ArrowRight size={15} className="shrink-0 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
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
