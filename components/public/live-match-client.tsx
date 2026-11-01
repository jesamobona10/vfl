"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ChevronDown, MapPin, Play } from "lucide-react";
import { useLiveClock } from "@/components/live/live-clock";
import type { LiveClockSettings } from "@/lib/logic/live";
import { createPublicClient } from "@/lib/supabase/public";
import type { PublicLiveEventRow, PublicMatchRow } from "@/lib/types";
import { ShareMatchButton } from "@/components/public/share-match-button";
import { FollowTeamsButton } from "@/components/public/follow-teams-button";
import type { MatchMediaItem } from "@/lib/match-media";
import { MatchLineupsDisplay } from "@/components/fixtures/fixture-lineups";
import { MATCH_EVENT_CATEGORIES, matchEventCategory, type MatchEventCategory } from "@/lib/match-event-categories";

type Event = any;

function eventLabel(event: Event, homeName: string, awayName: string) {
  const team = event.team_id === event.home_team_id ? homeName : awayName;
  const name = event.player_name || "Player";
  if (!event.player_name && event.event_type === "goal") return `Goal for ${team}`;
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
    default: return `${name} · ${String(event.event_type).replace(/[-_]/g, " ")} · ${team}`;
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
  return <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold text-ink-3">SCHEDULED</span>;
}

function TeamLogo({ name, logo }: { name: string | null; logo: string | null }) {
  if (!name) return <div className="h-12 w-12 rounded-full bg-surface-2" />;
  return logo ? (
    <Image src={logo} alt="" width={56} height={56} className="h-12 w-12 rounded-full border border-line bg-surface-2 object-cover sm:h-14 sm:w-14" />
  ) : (
    <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface-2 text-lg font-bold text-ink-3 sm:h-14 sm:w-14">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function formatMinute(event: Event) {
  if (event.event_minute == null && event.minute == null) return null;
  const m = event.event_minute ?? event.minute;
  const s = event.stoppage_time ?? event.stoppage;
  return s ? `${m}+${s}` : `${m}`;
}

export function LiveMatchClient({
  initialData,
  matchId,
}: {
  initialData: { match: PublicMatchRow | null; events: Event[]; lineups: any[] };
  matchId: string;
}) {
  const [match, setMatch] = useState<PublicMatchRow | null>(initialData.match);
  const [events, setEvents] = useState<Event[]>(initialData.events);
  const [lineups] = useState<any[]>(initialData.lineups);
  const [loading] = useState(!initialData.match);
  const [error] = useState<string | null>(null);
  const [media, setMedia] = useState<MatchMediaItem[]>([]);
  const [activeEventCategory, setActiveEventCategory] = useState<MatchEventCategory>("Scoring");
  const [showLineups, setShowLineups] = useState(false);
  const [clockSettings, setClockSettings] = useState<LiveClockSettings | null>(null);
  const supabase = useMemo(() => createPublicClient(), []);

  const clock = useLiveClock({
    status: (match?.status ?? null) as any,
    startedAt: match?.live_started_at ?? null,
    settings: clockSettings as any,
  } as any);

  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;
    const loadMedia = async () => {
      try {
        const res = await fetch(`/api/public/matches/${matchId}/media`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setMedia(Array.isArray(json.items) ? json.items : []);
      } catch {
        // ignore
      }
    };
    void loadMedia();
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  useEffect(() => {
    if (!match?.competition_id) return;
    let cancelled = false;
    const loadSettings = async () => {
      try {
        const res = await fetch(`/api/competitions/${match.competition_id}/live-settings`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json.settings) {
          setClockSettings({
            halftimeMinutes: json.settings.halftime_minutes ?? 45,
            stoppageMinutes: json.settings.stoppage_minutes ?? 0,
          } as LiveClockSettings);
        }
      } catch {
        // ignore
      }
    };
    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [match?.competition_id]);

  useEffect(() => {
    if (!matchId) return;
    const channel = supabase
      .channel(`public-match-${matchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `id=eq.${matchId}` },
        async () => {
          try {
            const res = await fetch(`/api/public/matches/${matchId}`);
            if (!res.ok) return;
            const json = await res.json();
            if (json.match) setMatch(json.match);
          } catch {
            // ignore
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "match_events", filter: `match_id=eq.${matchId}` },
        () => {
          window.location.reload();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [matchId, supabase]);

  const homeName = match?.home_team_name || "Home";
  const awayName = match?.away_team_name || "Away";

  const filteredEvents = useMemo(() => {
    const list = [...events].sort((a, b) => {
      const ma = a.event_minute ?? a.minute ?? 0;
      const mb = b.event_minute ?? b.minute ?? 0;
      if (ma !== mb) return ma - mb;
      return (a.id ?? 0) - (b.id ?? 0);
    });
    if (activeEventCategory === "all" as any) return list;
    try {
      return list.filter((event) => matchEventCategory(event.event_type) === activeEventCategory);
    } catch {
      return list;
    }
  }, [activeEventCategory, events]);

  const fixtureLineups: any[] = useMemo(() => {
    return lineups.map((l: any) => ({
      id: l.id,
      team_id: l.team_id,
      player_id: l.player_id,
      player_name: l.player_name,
      jersey_number: l.jersey_number,
      position: l.position,
      is_starter: Boolean(l.is_starter),
      team_name: l.team_name,
      formation: l.formation,
      status: l.status,
      starting_xi: l.starting_xi,
      substitutes: l.substitutes,
    }));
  }, [lineups]);

  if (loading && !match) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-4xl items-center justify-center px-4">
        <div className="text-sm text-muted">Loading match...</div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-4xl flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-lg font-semibold">Match not found</p>
        <p className="text-sm text-muted">{error || "This match is not available publicly."}</p>
        <Link href="/public" className="btn btn-primary btn-sm mt-2">
          Back to public dashboard
        </Link>
      </div>
    );
  }

  const minuteLabel = clock?.label === "HT" ? clock.label : clock?.minute ? `${clock.minute}${clock.stoppage ? `+${clock.stoppage}` : ""}'` : null;

  return (
    <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/public" className="inline-flex items-center gap-2 text-sm text-muted hover:text-text">
          <ArrowLeft size={16} />
          Back to dashboard
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <FollowTeamsButton organizationId="" teamIds={[]} />
          <ShareMatchButton title={`${homeName} vs ${awayName}`} text={`${homeName} vs ${awayName}`} />
        </div>
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-col items-center gap-4 px-4 py-6 sm:flex-row sm:justify-between sm:px-6">
          <div className="flex flex-1 flex-col items-center gap-2 text-center sm:flex-row sm:justify-end sm:gap-3 sm:text-right">
            <TeamLogo name={homeName} logo={match.home_team_logo || null} />
            <div className="min-w-0">
              <p className="text-base font-bold sm:text-lg">{homeName}</p>
              <p className="text-xs text-ink-3">{match.round ? `Round ${match.round}` : null}</p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <StatusBadge match={match} minute={minuteLabel} />
            <p className={`text-4xl font-bold tabular-nums sm:text-5xl ${match.status === "scheduled" ? "text-ink-3" : "text-text"}`}>
              {match.status === "scheduled" ? "VS" : `${match.home_score ?? 0} - ${match.away_score ?? 0}`}
            </p>
            <p className="flex items-center gap-1.5 text-xs text-ink-3">
              <MapPin size={13} />
              {match.venue || "Venue TBA"}
            </p>
            {match.date && (
              <p className="text-xs text-ink-3">
                {new Date(`${match.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                {match.time ? ` · ${match.time}` : ""}
              </p>
            )}
          </div>
          <div className="flex flex-1 flex-col items-center gap-2 text-center sm:flex-row sm:gap-3 sm:text-left">
            <TeamLogo name={awayName} logo={match.away_team_logo || null} />
            <div className="min-w-0">
              <p className="text-base font-bold sm:text-lg">{awayName}</p>
              <p className="text-xs text-ink-3">{match.competition_name || null}</p>
            </div>
          </div>
        </div>
      </section>

      {fixtureLineups.length > 0 && (
        <section className="mt-4">
          <button
            type="button"
            onClick={() => setShowLineups((prev) => !prev)}
            className="mb-2 flex w-full items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-left"
          >
            <div>
              <p className="text-sm font-semibold">Lineups</p>
              <p className="text-xs text-ink-3">Starting XI and substitutes</p>
            </div>
            <ChevronDown size={16} className={`transition-transform ${showLineups ? "rotate-180" : ""}`} />
          </button>
          {showLineups && (
            <div className="card overflow-hidden">
              <MatchLineupsDisplay teams={[]} lineups={fixtureLineups as any} />
            </div>
          )}
        </section>
      )}

      <section className="mt-4 card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
          <div>
            <h2 className="font-bold">Match events</h2>
            <p className="mt-1 text-xs text-ink-3">Goals, cards, substitutions and key moments</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {(["all", ...MATCH_EVENT_CATEGORIES] as any).map((category: any) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveEventCategory(category)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${activeEventCategory === category ? "bg-brand text-white" : "bg-surface-2 text-ink-3"}`}
              >
                {category === "all" ? "All" : String(category).replace(/-/g, " ")}
              </button>
            ))}
          </div>
        </div>
        {filteredEvents.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">No events recorded yet.</p>
        ) : (
          <div className="divide-y divide-line/70">
            {filteredEvents.map((event: any) => {
              const isHome = event.team_id === match.home_team_id;
              const minute = formatMinute(event);
              const label = eventLabel(event, homeName, awayName);
              return (
                <div key={event.id || Math.random()} className="grid grid-cols-[4rem_minmax(0,1fr)_4rem] items-center gap-2 px-3 py-3 sm:px-5">
                  <div className="text-center text-sm font-bold tabular-nums text-ink-3">{minute ? `${minute}'` : "—"}</div>
                  <div className={`flex items-center gap-2 ${isHome ? "justify-start" : "justify-end"}`}>
                    {isHome ? (
                      <>
                        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${eventTone(event.event_type)}`}>
                          <Play size={14} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{label}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="min-w-0 text-right">
                          <p className="truncate text-sm font-semibold">{label}</p>
                        </div>
                        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${eventTone(event.event_type)}`}>
                          <Play size={14} />
                        </span>
                      </>
                    )}
                  </div>
                  <div className="text-center text-xs text-ink-3">{isHome ? homeName.slice(0, 3).toUpperCase() : awayName.slice(0, 3).toUpperCase()}</div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default LiveMatchClient;
