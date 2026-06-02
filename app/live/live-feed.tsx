"use client";

import { useEffect, useState, useCallback } from "react";
import { Radio, Calendar, MapPin, Clock, AlertCircle } from "lucide-react";

interface TeamInfo {
  name: string;
  logo?: string;
}

interface MatchData {
  id: number;
  round: number;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  date: string;
  time: string;
  venue: string;
}

interface LiveData {
  live: MatchData[];
  upcoming: MatchData[];
  today: string;
  fetchedAt: string;
}

function MatchCard({ match, isLive }: { match: MatchData; isLive: boolean }) {
  const statusBadge = isLive
    ? "bg-danger/10 text-danger"
    : match.status === "completed"
    ? "bg-muted/10 text-muted"
    : "bg-surface-2 text-muted";

  return (
    <div
      className={`rounded-3xl border p-5 shadow-sm transition-all ${
        isLive
          ? "border-danger/40 bg-danger/[0.04] shadow-danger/5"
          : "border-line bg-surface"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span>{match.homeTeam.name}</span>
            <span className="text-muted">vs</span>
            <span>{match.awayTeam.name}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="rounded-full bg-surface-2 px-2 py-1">
              Round {match.round}
            </span>
            <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusBadge}`}>
              {isLive ? "Live" : match.status === "completed" ? "Finished" : "Upcoming"}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-center">
          <div className="flex flex-col items-center min-w-[80px]">
            <div className="text-lg font-semibold">{match.homeTeam.name.charAt(0)}</div>
            <span className="text-xs text-muted">Home</span>
          </div>
          <div className="text-3xl font-extrabold tabular-nums">
            {isLive || match.status === "completed" ? match.homeScore ?? "-" : "-"}
            <span className="text-muted mx-1">:</span>
            {isLive || match.status === "completed" ? match.awayScore ?? "-" : "-"}
          </div>
          <div className="flex flex-col items-center min-w-[80px]">
            <div className="text-lg font-semibold">{match.awayTeam.name.charAt(0)}</div>
            <span className="text-xs text-muted">Away</span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3 text-xs text-muted">
        <div className="flex items-center gap-1">
          <MapPin size={12} />
          {match.venue || "Venue TBA"}
        </div>
        <div className="flex items-center gap-1">
          <Clock size={12} />
          {match.time || "Time TBA"}
        </div>
        <div className="flex items-center gap-1">
          <Calendar size={12} />
          {match.date}
        </div>
      </div>
    </div>
  );
}

export function LiveFeed() {
  const [data, setData] = useState<LiveData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLive = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const res = await fetch("/api/public/live");
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setData(json);
        setError("");
      }
    } catch {
      if (!silent) setError("Failed to load live scores.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLive();
    const interval = setInterval(() => fetchLive(true), 30000);
    return () => clearInterval(interval);
  }, [fetchLive]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-brand border-t-transparent rounded-full" />
      </div>
    );
  }

  const hasLive = data?.live && data.live.length > 0;
  const hasUpcoming = data?.upcoming && data.upcoming.length > 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Live Scores</h1>
          {hasLive && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-danger bg-danger/10 rounded-full px-3 py-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-danger" />
              </span>
              {data!.live.length} Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {refreshing && (
            <span className="text-xs text-muted animate-pulse">Refreshing...</span>
          )}
          <button
            onClick={() => fetchLive(true)}
            disabled={refreshing}
            className="btn-ghost text-sm"
          >
            <Clock size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-4 py-3">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {!hasLive && !hasUpcoming && !error && (
        <div className="text-center py-16 space-y-4">
          <Radio size={48} className="mx-auto text-muted/30" />
          <div>
            <p className="text-lg font-semibold text-muted">No matches today</p>
            <p className="text-sm text-muted/60 mt-1">
              Check back on match day for live scores.
            </p>
          </div>
        </div>
      )}

      {hasLive && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
            Now Playing
          </h2>
          <div className="space-y-3">
            {data!.live.map((m) => (
              <MatchCard key={m.id} match={m} isLive={true} />
            ))}
          </div>
        </div>
      )}

      {hasUpcoming && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
            <Calendar size={14} />
            Upcoming Today
          </h2>
          <div className="space-y-3">
            {data!.upcoming.map((m) => (
              <MatchCard key={m.id} match={m} isLive={false} />
            ))}
          </div>
        </div>
      )}

      {data && (hasLive || hasUpcoming) && (
        <p className="text-center text-xs text-muted/50">
          Auto-refreshes every 30s &middot; Last updated {new Date(data.fetchedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
