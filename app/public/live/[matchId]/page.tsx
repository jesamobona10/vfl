"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import type { PublicLiveEventRow } from "@/lib/types";

type Event = PublicLiveEventRow;

function eventLabel(e: Event) {
  const name = e.player_name || "Player";
  switch (e.event_type) {
    case "goal":
      return `${name} scored`;
    case "assist":
      return `Assist — ${name}`;
    case "yellow_card":
      return `Yellow card — ${name}`;
    case "red_card":
      return `Red card — ${name}`;
    case "sub_on":
      return `Sub on — ${name}`;
    case "sub_off":
      return `Sub off — ${name}`;
    default:
      return e.event_type;
  }
}

export default function PublicLiveMatchPage() {
  const params = useParams();
  const matchId = Number(params.matchId);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const matchHeader = useMemo(() => {
    if (events.length === 0) return null;
    const e = events[0];
    return {
      homeTeamName: e.home_team_name,
      awayTeamName: e.away_team_name,
      homeTeamLogo: e.home_team_logo,
      awayTeamLogo: e.away_team_logo,
      homeScore: e.home_score,
      awayScore: e.away_score,
      status: e.status,
      date: e.date,
      time: e.time,
      venue: e.venue,
      round: e.round,
    };
  }, [events]);

  useEffect(() => {
    if (!matchId) return;
    const sb = createPublicClient();
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      const { data, error } = await sb
        .from("public_live_events")
        .select("*")
        .eq("match_id", matchId)
        .order("minute", { ascending: true, nullsFirst: false })
        .order("event_id", { ascending: true });
      if (!mounted) return;
      if (error) {
        setError(error.message);
        setEvents([]);
      } else {
        setEvents((data as Event[]) || []);
      }
      setLoading(false);
    }

    load();

    const channel = sb
      .channel(`public-live-match-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_events",
          filter: `match_id=eq.${matchId}`,
        },
        () => {
          if (mounted) load();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "fixtures",
          filter: `id=eq.${matchId}`,
        },
        () => {
          if (mounted) load();
        }
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED" && mounted) {
          try {
            sb.realtime.connect();
          } catch {}
        }
      });

    const poll = setInterval(() => {
      if (mounted) load();
    }, 3000);

    return () => {
      mounted = false;
      clearInterval(poll);
      try {
        sb.removeChannel(channel);
      } catch {}
    };
  }, [matchId]);

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-2xl mx-auto">
      {loading && <div className="text-sm text-muted">Loading...</div>}
      {error && <div className="text-sm text-danger">{error}</div>}
      {!loading && !error && matchHeader && (
        <div className="card p-6 space-y-4 text-center">
          <div className="text-sm text-ink-3">
            {matchHeader.round ? `Round ${matchHeader.round}` : ""}
            {[matchHeader.date, matchHeader.time, matchHeader.venue]
              .filter(Boolean)
              .join(" · ")}
          </div>
          <div className="flex items-center justify-center gap-4 sm:gap-6">
            <div className="flex-1 min-w-0 text-right">
              <div className="text-sm sm:text-lg font-semibold truncate">
                {matchHeader.homeTeamName}
              </div>
            </div>
            <div className="text-3xl sm:text-4xl font-bold tabular-nums shrink-0">
              {matchHeader.homeScore ?? 0} — {matchHeader.awayScore ?? 0}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-sm sm:text-lg font-semibold truncate">
                {matchHeader.awayTeamName}
              </div>
            </div>
          </div>
          <div className="text-xs uppercase tracking-wide text-ink-3">
            {matchHeader.status}
          </div>
        </div>
      )}

      {!loading && !error && events.length > 0 && (
        <div className="space-y-2">
          {events.map((e, i) => (
            <div key={`${e.event_id}-${i}`} className="card p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">{eventLabel(e)}</div>
              </div>
              {e.minute != null && (
                <div className="text-xs text-ink-3 shrink-0">{e.minute}&apos;</div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="card p-6 text-center text-sm text-muted">
          No events yet for this match.
        </div>
      )}
    </div>
  );
}
