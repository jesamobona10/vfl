"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { useLiveClock } from "@/components/live/live-clock";
import type { LiveClockSettings } from "@/lib/logic/live";
import { createPublicClient } from "@/lib/supabase/public";
import type { PublicLiveEventRow, PublicMatchRow } from "@/lib/types";

type Event = PublicLiveEventRow;

function eventLabel(event: Event, homeName: string, awayName: string) {
  const name = event.player_name || "Player";
  const team = event.team_id === event.home_team_id ? homeName : awayName;
  switch (event.event_type) {
    case "goal": return `${name} scored for ${team}`;
    case "own-goal": return `${name} scored an own goal for ${team}`;
    case "assist": return `${name} assisted ${team}`;
    case "yellow":
    case "yellow_card": return `${name} received a yellow card for ${team}`;
    case "red":
    case "red_card": return `${name} received a red card for ${team}`;
    case "sub_on": return `${name} came on for ${team}`;
    case "sub_off": return `${name} came off for ${team}`;
    case "save": return `${name} made a save for ${team}`;
    case "penalty-save": return `${name} saved a penalty for ${team}`;
    case "motm": return `${name} was named player of the match for ${team}`;
    default: return `${name} · ${event.event_type.replace(/[-_]/g, " ")} · ${team}`;
  }
}

function eventTone(type: string) {
  if (type === "goal" || type === "own-goal") return "bg-brand/10 text-brand";
  if (type === "assist") return "bg-accent/10 text-accent";
  if (type === "red" || type === "red_card") return "bg-danger/10 text-danger";
  if (type === "yellow" || type === "yellow_card") return "bg-warn-500/15 text-warn-500";
  return "bg-surface-2 text-ink-3";
}

function StatusBadge({ match, minute }: { match: PublicMatchRow; minute: string | null }) {
  if (match.status === "completed") {
    return <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold text-ink-3">FULL-TIME</span>;
  }
  if (match.status === "live" || match.status === "in-progress") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-danger/10 px-2.5 py-1 text-xs font-bold text-danger">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
        {minute || "LIVE"}
      </span>
    );
  }
  return <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-bold text-brand">SCHEDULED</span>;
}

export default function PublicLiveMatchPage() {
  const params = useParams();
  const matchId = Number(params.matchId);
  const [match, setMatch] = useState<PublicMatchRow | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const halftimeRequestFor = useRef<number | null>(null);

  const clockSettings = useMemo<LiveClockSettings | undefined>(
    () => match ? {
      halftimeMinutes: match.halftime_minutes,
      stoppageMinutes: match.stoppage_minutes,
    } : undefined,
    [match]
  );
  const phase = useLiveClock(match?.live_started_at, clockSettings);
  const minuteLabel = phase
    ? phase.label === "HT"
      ? "HALF-TIME"
      : phase.label === "FT"
        ? "FULL-TIME"
        : `${phase.minute}${phase.stoppage ? ` ${phase.stoppage}` : ""}′`
    : null;

  useEffect(() => {
    if (!matchId) return;
    const sb = createPublicClient();
    let mounted = true;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      const [{ data: matchRow, error: matchError }, { data: eventRows, error: eventsError }] =
        await Promise.all([
          sb.from("public_matches").select("*").eq("match_id", matchId).maybeSingle(),
          sb
            .from("public_live_events")
            .select("*")
            .eq("match_id", matchId)
            .order("minute", { ascending: true, nullsFirst: false })
            .order("event_id", { ascending: true }),
        ]);

      if (!mounted) return;
      if (matchError || eventsError) {
        setError("Unable to load match updates. Please try again.");
      } else {
        setMatch((matchRow as PublicMatchRow | null) || null);
        setEvents((eventRows as Event[]) || []);
        setError(null);
      }
      setLoading(false);
    }

    const scheduleLoad = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void load(), 120);
    };

    void load();
    const channel = sb
      .channel(`public-live-match-${matchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_events", filter: `match_id=eq.${matchId}` },
        scheduleLoad
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "fixtures", filter: `id=eq.${matchId}` },
        scheduleLoad
      )
      .subscribe();

    const poll = setInterval(() => void load(), 20000);
    return () => {
      mounted = false;
      clearInterval(poll);
      if (refreshTimer) clearTimeout(refreshTimer);
      void sb.removeChannel(channel);
    };
  }, [matchId]);

  useEffect(() => {
    if (phase?.label !== "HT" || halftimeRequestFor.current === matchId) return;
    halftimeRequestFor.current = matchId;
    fetch(`/api/public/matches/${matchId}/halftime`, { method: "POST" }).catch(() => {
      halftimeRequestFor.current = null;
    });
  }, [matchId, phase?.label]);

  const liveEvents = useMemo(() => [...events].reverse(), [events]);

  if (loading) {
    return <div className="p-6 text-center text-sm text-muted">Loading match updates...</div>;
  }

  if (error || !match) {
    return (
      <div className="p-6 text-center text-sm text-danger">
        {error || "Match not found or no longer available."}
      </div>
    );
  }

  const isLive = match.status === "live" || match.status === "in-progress";
  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
      <div className="card space-y-4 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3 text-xs text-ink-3">
          <span>Round {match.round}{match.date ? ` · ${match.date}` : ""}{match.time ? ` · ${match.time}` : ""}</span>
          <StatusBadge match={match} minute={isLive ? minuteLabel : null} />
        </div>
        <div className="flex items-center justify-center gap-3 sm:gap-6">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
            {match.home_team_logo ? (
              <Image src={match.home_team_logo} alt="" width={48} height={48} className="h-12 w-12 rounded-full object-cover" />
            ) : <div className="h-12 w-12 rounded-full bg-surface-2" />}
            <span className="w-full truncate text-sm font-semibold sm:text-base">{match.home_team_name}</span>
          </div>
          <div className="shrink-0 text-3xl font-bold tabular-nums sm:text-4xl">
            {match.home_score ?? 0} — {match.away_score ?? 0}
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
            {match.away_team_logo ? (
              <Image src={match.away_team_logo} alt="" width={48} height={48} className="h-12 w-12 rounded-full object-cover" />
            ) : <div className="h-12 w-12 rounded-full bg-surface-2" />}
            <span className="w-full truncate text-sm font-semibold sm:text-base">{match.away_team_name}</span>
          </div>
        </div>
        {match.venue && <p className="text-center text-xs text-ink-3">{match.venue}</p>}
      </div>

      <section aria-labelledby="match-timeline-heading" className="space-y-3">
        <h2 id="match-timeline-heading" className="text-sm font-semibold uppercase tracking-wide text-ink-3">
          Match updates
        </h2>
        {liveEvents.length > 0 ? liveEvents.map((event) => (
          <div key={event.event_id} className="card flex items-center gap-3 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-ink-3">
              {event.player_name?.slice(0, 1) || "•"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {eventLabel(event, match.home_team_name, match.away_team_name)}
              </p>
              {event.player_name && <p className="text-xs text-ink-3">{event.player_name}</p>}
            </div>
            <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${eventTone(event.event_type)}`}>
              {event.event_type.replace(/[-_]/g, " ")}
            </span>
            {event.minute != null && <span className="shrink-0 text-xs tabular-nums text-ink-3">{event.minute}′</span>}
          </div>
        )) : (
          <div className="card p-5 text-center text-sm text-muted">
            {isLive ? "Match is underway. Updates will appear here as they happen." : "No player events have been recorded for this match."}
          </div>
        )}
      </section>
    </div>
  );
}
