"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BarChart3, CalendarClock, MapPin, Radio, Trophy } from "lucide-react";
import { createPublicClient } from "@/lib/supabase/public";
import type { PublicMatchRow, PublicPlayerStatisticsRow, PublicStandingRow } from "@/lib/types";
import { PushSubscriptionControl } from "@/components/public/push-subscription";

type MatchFilter = "all" | "scheduled" | "live" | "completed";
type PublicSection = "matches" | "standings" | "players";

interface PublicCompetitionOption {
  key: string;
  competitionId: string;
  seasonId: string | null;
  label: string;
}

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
  const [section, setSection] = useState<PublicSection>("matches");
  const [selectedCompetitionKey, setSelectedCompetitionKey] = useState("");
  const [standings, setStandings] = useState<PublicStandingRow[]>([]);
  const [playerStatistics, setPlayerStatistics] = useState<PublicPlayerStatisticsRow[]>([]);
  const [loadedStatsKey, setLoadedStatsKey] = useState("");
  const [statsError, setStatsError] = useState<string | null>(null);
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

  const competitionOptions = useMemo(() => {
    const options = new Map<string, PublicCompetitionOption>();
    for (const match of matches) {
      if (!match.competition_id) continue;
      const seasonId = match.season_id || null;
      const key = `${match.competition_id}:${seasonId || "legacy"}`;
      if (!options.has(key)) {
        options.set(key, {
          key,
          competitionId: match.competition_id,
          seasonId,
          label: [match.competition_name || "Competition", match.season_name || (seasonId ? "Season" : "All seasons")]
            .filter(Boolean)
            .join(" · "),
        });
      }
    }
    return [...options.values()];
  }, [matches]);

  const activeCompetition = competitionOptions.find((option) => option.key === selectedCompetitionKey)
    || competitionOptions[0]
    || null;
  const activeCompetitionKey = activeCompetition?.key || "";
  const activeCompetitionId = activeCompetition?.competitionId || "";
  const activeSeasonId = activeCompetition?.seasonId || null;

  useEffect(() => {
    if (!activeCompetitionId || section === "matches") return;
    const sb = createPublicClient();
    let mounted = true;

    async function loadStats() {
      let standingsQuery = sb
        .from("public_standings")
        .select("*")
        .eq("competition_id", activeCompetitionId)
        .order("points", { ascending: false })
        .order("gd", { ascending: false })
        .order("gf", { ascending: false })
        .order("team_name", { ascending: true });
      let playerStatsQuery = sb
        .from("public_player_statistics")
        .select("*")
        .eq("competition_id", activeCompetitionId)
        .order("goals", { ascending: false })
        .order("assists", { ascending: false })
        .order("player_name", { ascending: true });

      if (activeSeasonId) {
        standingsQuery = standingsQuery.eq("season_id", activeSeasonId);
        playerStatsQuery = playerStatsQuery.eq("season_id", activeSeasonId);
      } else {
        standingsQuery = standingsQuery.is("season_id", null);
        playerStatsQuery = playerStatsQuery.is("season_id", null);
      }

      const [{ data: standingsRows, error: standingsError }, { data: statRows, error: statsLoadError }] =
        await Promise.all([standingsQuery, playerStatsQuery]);
      if (!mounted) return;

      if (standingsError || statsLoadError) {
        setStatsError("Unable to load public standings and player statistics.");
      } else {
        setStandings((standingsRows as PublicStandingRow[]) || []);
        setPlayerStatistics((statRows as PublicPlayerStatisticsRow[]) || []);
        setStatsError(null);
      }
      setLoadedStatsKey(activeCompetitionKey);
    }

    void loadStats();
    const refresh = () => void loadStats();
    const channel = sb
      .channel(`public-statistics-${activeCompetitionKey}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "fixtures" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_events" }, refresh)
      .subscribe();
    const poll = setInterval(refresh, 30000);

    return () => {
      mounted = false;
      clearInterval(poll);
      void sb.removeChannel(channel);
    };
  }, [activeCompetitionId, activeCompetitionKey, activeSeasonId, section]);

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

      <nav className="flex gap-2 rounded-2xl border border-line bg-surface-2/50 p-1.5" aria-label="Public match centre sections">
        {([
          ["matches", "Matches", Radio],
          ["standings", "Standings", Trophy],
          ["players", "Player stats", BarChart3],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            aria-pressed={section === key}
            onClick={() => setSection(key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-semibold transition-colors sm:gap-2 sm:text-sm ${
              section === key ? "bg-surface text-brand shadow-sm" : "text-ink-3 hover:text-ink-1"
            }`}
          >
            <Icon size={15} />{label}
          </button>
        ))}
      </nav>

      {section === "matches" && <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter matches">
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
      </div>}

      {section !== "matches" && (
        <section className="space-y-4">
          {competitionOptions.length > 0 && (
            <label className="block max-w-sm">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-3">Competition</span>
              <select
                value={activeCompetitionKey}
                onChange={(event) => setSelectedCompetitionKey(event.target.value)}
                className="input w-full"
                aria-label="Select competition and season"
              >
                {competitionOptions.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
            </label>
          )}

          {competitionOptions.length === 0 ? (
            <div className="card p-6 text-center text-sm text-muted">Standings and player statistics will appear when public competition matches are available.</div>
          ) : loadedStatsKey !== activeCompetitionKey ? (
            <div className="card p-6 text-center text-sm text-muted">Loading competition statistics…</div>
          ) : statsError ? (
            <div className="card p-6 text-center text-sm text-danger">{statsError}</div>
          ) : section === "standings" ? (
            <div className="card overflow-hidden">
              <div className="border-b border-line px-4 py-4 sm:px-5">
                <h2 className="font-bold">League standings</h2>
                <p className="mt-1 text-xs text-ink-3">Live and completed match results</p>
              </div>
              {standings.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[610px] text-left text-xs sm:text-sm">
                    <thead className="bg-surface-2/50 text-[10px] uppercase tracking-wider text-ink-3">
                      <tr>
                        <th className="px-3 py-3 text-center">#</th><th className="px-3 py-3">Team</th>
                        <th className="px-3 py-3 text-center">P</th><th className="px-3 py-3 text-center">W</th>
                        <th className="px-3 py-3 text-center">D</th><th className="px-3 py-3 text-center">L</th>
                        <th className="px-3 py-3 text-center">GD</th><th className="px-3 py-3 text-center">Pts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/70">
                      {standings.map((row, index) => (
                        <tr key={row.team_id} className={index === 0 ? "bg-brand/5" : ""}>
                          <td className="px-3 py-3 text-center font-bold text-ink-3">{index + 1}</td>
                          <td className="px-3 py-3 font-semibold"><span className="flex items-center gap-2.5">
                            {row.team_logo ? <Image src={row.team_logo} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-[10px]">{row.team_name.charAt(0)}</span>}
                            <span className="whitespace-nowrap">{row.team_name}</span>
                          </span></td>
                          <td className="px-3 py-3 text-center tabular-nums">{row.played}</td>
                          <td className="px-3 py-3 text-center tabular-nums">{row.won}</td>
                          <td className="px-3 py-3 text-center tabular-nums">{row.drawn}</td>
                          <td className="px-3 py-3 text-center tabular-nums">{row.lost}</td>
                          <td className="px-3 py-3 text-center tabular-nums">{row.gd > 0 ? "+" : ""}{row.gd}</td>
                          <td className="px-3 py-3 text-center font-bold tabular-nums">{row.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="p-6 text-center text-sm text-muted">No public standings are available yet.</p>}
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="border-b border-line px-4 py-4 sm:px-5">
                <h2 className="font-bold">Player statistics</h2>
                <p className="mt-1 text-xs text-ink-3">Goals, assists, appearances, and cards in completed matches</p>
              </div>
              {playerStatistics.length ? (
                <div className="divide-y divide-line/70">
                  {playerStatistics.map((player, index) => (
                    <div key={player.player_id} className="grid grid-cols-[2rem_minmax(0,1fr)_repeat(4,2rem)] items-center gap-1.5 px-3 py-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_repeat(4,3rem)] sm:gap-2 sm:px-5">
                      <span className="text-center text-xs font-semibold text-ink-3">{index + 1}</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{player.player_name}</p>
                        <p className="truncate text-[10px] text-ink-3">{player.team_name} · {player.appearances} apps</p>
                      </div>
                      <span className="text-center"><b className="block text-sm tabular-nums">{player.goals}</b><small className="text-[9px] uppercase text-ink-3">G</small></span>
                      <span className="text-center"><b className="block text-sm tabular-nums">{player.assists}</b><small className="text-[9px] uppercase text-ink-3">A</small></span>
                      <span className="text-center"><b className="block text-sm tabular-nums">{player.yellow_cards}</b><small className="text-[9px] uppercase text-ink-3">YC</small></span>
                      <span className="text-center"><b className="block text-sm tabular-nums">{player.red_cards}</b><small className="text-[9px] uppercase text-ink-3">RC</small></span>
                    </div>
                  ))}
                </div>
              ) : <p className="p-6 text-center text-sm text-muted">No player events have been recorded in completed matches yet.</p>}
            </div>
          )}
        </section>
      )}

      {section === "matches" && loading && <div className="text-sm text-muted">Loading matches...</div>}
      {section === "matches" && error && <div className="text-sm text-danger">{error}</div>}

      {section === "matches" && !loading && !error && visibleMatches.length > 0 && (
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
                  <span className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-brand">
                    {category === "completed" ? "View events" : category === "live" ? "Follow live" : "Match details"}
                    <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {section === "matches" && !loading && !error && visibleMatches.length === 0 && (
        <div className="card p-6 text-center text-sm text-muted">
          {filter === "all"
            ? "No matches available right now."
            : `No ${filter === "completed" ? "full-time" : filter} matches available right now.`}
        </div>
      )}
    </div>
  );
}
