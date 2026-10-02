"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { useLiveClock } from "@/components/live/live-clock";
import type { LiveClockSettings } from "@/lib/logic/live";
import { createPublicClient } from "@/lib/supabase/public";
import type { PublicLiveEventRow, PublicMatchRow } from "@/lib/types";
import { readPublicPreferences } from "@/lib/public-preferences";

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
  const router = useRouter();
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
        const loadedMatch = (matchRow as PublicMatchRow | null) || null;
        const preferences = readPublicPreferences();
        if (!preferences) {
          router.replace("/public");
          return;
        }
        const followsMatch = Boolean(loadedMatch && loadedMatch.organization_id === preferences.organizationId);
        if (!followsMatch) {
          setError("This match is outside your followed organization. Update your preferences to see it.");
          setMatch(null);
          setEvents([]);
        } else {
          setMatch(loadedMatch);
          setEvents((eventRows as Event[]) || []);
          setError(null);
        }
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
  }, [matchId, router]);

  useEffect(() => {
    if (phase?.label !== "HT" || halftimeRequestFor.current === matchId) return;
    halftimeRequestFor.current = matchId;
    fetch(`/api/public/matches/${matchId}/halftime`, { method: "POST" }).catch(() => {
      halftimeRequestFor.current = null;
    });
  }, [matchId, phase?.label]);

  const liveEvents = useMemo(() => [...events].reverse(), [events]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
        <Link href="/public" className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink-2">
          <ArrowLeft size={16} /> Matches
        </Link>
        <div className="p-6 text-center text-sm text-muted">Loading match updates...</div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
        <Link href="/public" className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink-2">
          <ArrowLeft size={16} /> Matches
        </Link>
        <div className="card p-6 text-center text-sm text-danger">
          {error || "Match not found or no longer available."}
        </div>
      </div>
    );
  }

  const isLive = match.status === "live" || match.status === "in-progress";
  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/public"
          className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink-2 transition-colors hover:border-brand/30 hover:bg-surface-2"
        >
          <ArrowLeft size={16} /> Matches
        </Link>
        <div className="text-xs text-ink-3">
          Round {match.round}{match.date ? ` · ${match.date}` : ""}{match.time ? ` · ${match.time}` : ""}
        </div>
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2/40 px-4 py-3 sm:px-6">
          <div className="inline-flex items-center gap-1.5 text-xs text-ink-3">
            {match.venue ? <><MapPin size={14} />{match.venue}</> : "Match centre"}
          </div>
          <StatusBadge match={match} minute={isLive ? minuteLabel : null} />
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 bg-gradient-to-b from-surface to-surface-2/20 px-3 py-7 sm:gap-6 sm:px-7 sm:py-9">
          <div className="flex min-w-0 flex-col items-center gap-3 text-center">
            {match.home_team_logo ? (
              <Image src={match.home_team_logo} alt="" width={64} height={64} className="h-14 w-14 rounded-full border border-line bg-surface object-cover shadow-sm sm:h-16 sm:w-16" />
            ) : <div className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-surface-2 text-xl font-bold text-ink-3 sm:h-16 sm:w-16">{match.home_team_name.charAt(0)}</div>}
            <span className="w-full truncate text-xs font-semibold sm:text-base">{match.home_team_name}</span>
          </div>
          <div className="shrink-0 text-center">
            <div className="rounded-2xl border border-line bg-surface px-4 py-2 text-3xl font-extrabold tabular-nums shadow-sm sm:px-6 sm:py-3 sm:text-4xl">
              {match.home_score ?? 0}<span className="mx-1.5 text-ink-3">–</span>{match.away_score ?? 0}
            </div>
            {isLive && <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-danger">Live score</p>}
          </div>
          <div className="flex min-w-0 flex-col items-center gap-3 text-center">
            {match.away_team_logo ? (
              <Image src={match.away_team_logo} alt="" width={64} height={64} className="h-14 w-14 rounded-full border border-line bg-surface object-cover shadow-sm sm:h-16 sm:w-16" />
            ) : <div className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-surface-2 text-xl font-bold text-ink-3 sm:h-16 sm:w-16">{match.away_team_name.charAt(0)}</div>}
            <span className="w-full truncate text-xs font-semibold sm:text-base">{match.away_team_name}</span>
          </div>
        </div>
      </section>

      <section aria-labelledby="match-timeline-heading" className="space-y-3">
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <h2 id="match-timeline-heading" className="text-base font-bold">Match timeline</h2>
            <p className="mt-0.5 text-xs text-ink-3">Goals, cards, and other match events</p>
          </div>
          {liveEvents.length > 0 && <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink-3">{liveEvents.length} updates</span>}
        </div>
        {liveEvents.length > 0 ? liveEvents.map((event) => (
          <div key={event.event_id} className="card flex items-center gap-3 border-l-2 border-l-brand/40 p-3.5 sm:gap-4 sm:p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-sm font-bold text-ink-3">
              {event.player_name?.slice(0, 1) || "•"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-snug">
                {eventLabel(event, match.home_team_name, match.away_team_name)}
              </p>
              <p className="mt-1 text-xs text-ink-3">
                {event.team_id === event.home_team_id ? match.home_team_name : match.away_team_name}
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${eventTone(event.event_type)}`}>
              {event.event_type.replace(/[-_]/g, " ")}
            </span>
            {event.minute != null && <span className="min-w-8 shrink-0 text-right text-sm font-semibold tabular-nums text-ink-2">{event.minute}′</span>}
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
