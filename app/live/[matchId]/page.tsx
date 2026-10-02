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

export default function LiveMatchPage() {
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
        setEvents(data || []);
      }
      setLoading(false);
    }

    load();

    const channel = sb
      .channel(`live-match-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "match_events",
          filter: `match_id=eq.${matchId}`,
        },
        async () => {
          await load();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "match_events",
          filter: `match_id=eq.${matchId}`,
        },
        async () => {
          await load();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "fixtures", filter: `id=eq.${matchId}` },
        async () => {
          await load();
        }
      )
      .subscribe();

    const reconnect = setInterval(() => {
      if (channel.state !== "joined" && channel.state !== "joining") {
        sb.realtime.connect();
      }
    }, 3000);

    return () => {
      mounted = false;
      clearInterval(reconnect);
      sb.removeChannel(channel);
    };
  }, [matchId]);

  if (!matchId || isNaN(matchId)) return <div className="p-6">Invalid match</div>;
  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-danger">{error}</div>;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {matchHeader && (
        <div className="card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-wide text-ink-3">
              Round {matchHeader.round}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-2 text-ink-2">
              {matchHeader.status}
            </span>
          </div>
          <div className="flex items-center justify-center gap-4 sm:gap-6">
            <div className="flex flex-col items-center min-w-0 flex-1">
              {matchHeader.homeTeamLogo && (
                <img
                  src={matchHeader.homeTeamLogo}
                  alt=""
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover mb-2"
                />
              )}
              <div className="text-sm sm:text-base font-medium truncate max-w-full text-center">
                {matchHeader.homeTeamName}
              </div>
            </div>
            <div className="text-3xl sm:text-4xl font-bold tabular-nums">
              {matchHeader.homeScore ?? 0} — {matchHeader.awayScore ?? 0}
            </div>
            <div className="flex flex-col items-center min-w-0 flex-1">
              {matchHeader.awayTeamLogo && (
                <img
                  src={matchHeader.awayTeamLogo}
                  alt=""
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover mb-2"
                />
              )}
              <div className="text-sm sm:text-base font-medium truncate max-w-full text-center">
                {matchHeader.awayTeamName}
              </div>
            </div>
          </div>
          {(matchHeader.date || matchHeader.time || matchHeader.venue) && (
            <div className="text-center text-xs text-ink-3 mt-4">
              {[matchHeader.date, matchHeader.time, matchHeader.venue].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-base font-semibold">Match updates</h2>
        {events.length === 0 && (
          <div className="card p-4 text-sm text-muted">No events recorded yet.</div>
        )}
        <div className="space-y-2">
          {events.map((e) => (
            <div key={e.event_id} className="card p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{eventLabel(e)}</div>
                <div className="text-xs text-ink-3">{e.event_type.replace(/_/g, " ")}</div>
              </div>
              <div className="text-sm tabular-nums shrink-0">
                {e.minute != null ? `${e.minute}'` : "—"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
