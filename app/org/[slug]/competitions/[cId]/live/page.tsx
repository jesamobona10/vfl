"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useCompetition } from "@/lib/hooks/use-competitions";
import { LiveMatchCard } from "@/components/live/live-match-card";
import { EmptyState, LoadingState } from "@/components/shared/skeleton";
import { liveSettings, matchKickoff, type LiveClockSettings } from "@/lib/logic/live";
import { Play } from "lucide-react";
import type { Match, Team } from "@/lib/types";

interface LiveData {
  live: Match[];
  upcoming: Match[];
  teams: Team[];
  now: string;
  diagnostics?: LiveDiagnostic[];
}

interface LiveDiagnostic {
  id: number;
  round: number;
  match: string;
  status: string;
  date: string;
  time: string;
  competition_id: string | null;
  season_id: string | null;
  kickoff: string | null;
  tzOffset: number;
  now: string;
  reason: string;
}

export default function LiveEventPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const cId = params.cId as string;
  const seasonId = searchParams.get("seasonId");
  const debug = searchParams.get("debug") === "1";

  const { data: competition } = useCompetition(cId);
  const teams = useAppStore((s) => s.teams);
  const isAdmin = useAppStore((s) => s.isAdmin);
  const userProfile = useAppStore((s) => s.userProfile);

  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());

  const settings: LiveClockSettings | undefined = useMemo(
    () => (competition ? liveSettings(competition.settings) : undefined),
    [competition]
  );

  const canEdit = isAdmin || userProfile?.role === "org_admin";

  const load = () => {
    const query = new URLSearchParams({ competition_id: cId });
    if (seasonId) query.set("season_id", seasonId);
    query.set("tz", String(new Date().getTimezoneOffset()));
    if (debug) query.set("debug", "1");
    fetch(`/api/organizations/${slug}/live?${query.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
          return;
        }
        setData(d);
        setError(null);
      })
      .catch(() => setError("Failed to load live matches."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    load();
    const id = window.setInterval(load, 15000);
    return () => window.clearInterval(id);
  }, [slug, cId, seasonId]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const getTeam = (id: number): Team | undefined =>
    teams.find((t) => t.id === id) || data?.teams.find((t) => t.id === id);

  const handleStart = async (match: Match) => {
    setStartingId(match.id);
    setError(null);
    try {
      const res = await fetch(`/api/fixtures/${match.id}/start`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Unable to start the match.");
        return;
      }
      useAppStore.getState().updateMatch(match.id, "status", "live");
      useAppStore.getState().updateMatch(match.id, "live_started_at", new Date().toISOString());
      load();
    } catch {
      setError("Unable to start the match.");
    } finally {
      setStartingId(null);
    }
  };

  if (loading && !data) {
    return <LoadingState label="Loading live matches" />;
  }

  const live = data?.live || [];
  const upcoming = data?.upcoming || [];

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {debug && data?.diagnostics && (
        <div className="rounded-xl border border-line bg-surface-2/50 px-4 py-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            Diagnostics (debug=1)
          </p>
          <p className="text-xs text-muted">
            Server now: <code className="text-text">{data.now}</code>
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-muted border-b border-line">
                  <th className="py-1 pr-3">Match</th>
                  <th className="py-1 pr-3">Status</th>
                  <th className="py-1 pr-3">Date/Time</th>
                  <th className="py-1 pr-3">Kickoff (UTC)</th>
                  <th className="py-1">Why</th>
                </tr>
              </thead>
              <tbody>
                {data.diagnostics.map((d) => (
                  <tr key={d.id} className="border-b border-line/60">
                    <td className="py-1 pr-3">
                      R{d.round} · {d.match}
                    </td>
                    <td className="py-1 pr-3">{d.status}</td>
                    <td className="py-1 pr-3 tabular-nums">
                      {d.date ? d.date : "—"} {d.time ? d.time : "—"}
                    </td>
                    <td className="py-1 pr-3 tabular-nums">{d.kickoff || "—"}</td>
                    <td className="py-1 text-warn-500">{d.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {live.length === 0 && upcoming.length === 0 ? (
        <EmptyState
          title="No live matches"
          description="Scheduled matches appear here automatically 10 minutes before kickoff and can be started up to 10 minutes after kickoff."
        />
      ) : (
        <>
          {live.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted mb-3 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-live-500" />
                </span>
                Live Now
              </h2>
              <div className="grid gap-4">
                {live.map((match) => (
                  <LiveMatchCard
                    key={match.id}
                    match={match}
                    homeTeam={getTeam(match.homeId)}
                    awayTeam={getTeam(match.awayId)}
                    settings={settings}
                    canEdit={canEdit}
                    onFinished={load}
                  />
                ))}
              </div>
            </div>
          )}

          {upcoming.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted mb-3">
                Upcoming
              </h2>
              <div className="grid gap-3">
                {upcoming.map((match) => {
                  const home = getTeam(match.homeId);
                  const away = getTeam(match.awayId);
                  const kickoff = matchKickoff(match, new Date().getTimezoneOffset());
                  const kickoffTs = kickoff ? kickoff.getTime() : null;
                  const canStart = kickoffTs !== null && nowTs >= kickoffTs;
                  const delayed = kickoffTs !== null && nowTs > kickoffTs;
                  const startsIn =
                    kickoffTs !== null && kickoffTs > nowTs
                      ? kickoffTs - nowTs > 60_000
                        ? `Starts in ${Math.ceil((kickoffTs - nowTs) / 60_000)} min`
                        : "Starts shortly"
                      : null;
                  return (
                    <div
                      key={match.id}
                      className="card px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-semibold truncate">{home?.name || "?"}</span>
                          {home?.logo_url && (
                            <img
                              src={home.logo_url}
                              alt=""
                              className="w-8 h-8 rounded object-cover shrink-0"
                            />
                          )}
                        </div>
                        <span className="text-sm font-bold text-muted">vs</span>
                        <div className="flex items-center gap-3 min-w-0">
                          {away?.logo_url && (
                            <img
                              src={away.logo_url}
                              alt=""
                              className="w-8 h-8 rounded object-cover shrink-0"
                            />
                          )}
                          <span className="font-semibold truncate">{away?.name || "?"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted">
                          {match.time ? `Kickoff ${match.time}` : "Kickoff soon"}
                          {delayed && (
                            <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded bg-warn-500/15 text-warn-500 text-xs font-semibold uppercase">
                              Delayed
                            </span>
                          )}
                        </span>
                        {canEdit && (
                          <div className="flex flex-col items-end gap-1">
                            {startsIn && (
                              <span className="text-xs text-muted tabular-nums">
                                {startsIn}
                              </span>
                            )}
                            <button
                              onClick={() => handleStart(match)}
                              disabled={!canStart || startingId === match.id}
                              title={!canStart ? "Available at kickoff time" : undefined}
                              className={`btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 ${!canStart ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                              <Play size={12} />
                              {startingId === match.id ? "Starting..." : "Start Match"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
