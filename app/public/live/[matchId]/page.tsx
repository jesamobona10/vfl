"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ChevronDown, MapPin, Play, X } from "lucide-react";
import { useLiveClock } from "@/components/live/live-clock";
import type { LiveClockSettings } from "@/lib/logic/live";
import { createPublicClient } from "@/lib/supabase/public";
import type { PublicLiveEventRow, PublicMatchRow } from "@/lib/types";
import { readPublicPreferences } from "@/lib/public-preferences";
import { ShareMatchButton } from "@/components/public/share-match-button";
import { FollowTeamsButton } from "@/components/public/follow-teams-button";
import type { MatchMediaItem } from "@/lib/match-media";
import { MatchLineupsDisplay, type FixtureLineup } from "@/components/fixtures/fixture-lineups";
import { MATCH_EVENT_CATEGORIES, matchEventCategory, matchEventCategoryColor, type MatchEventCategory } from "@/lib/match-event-categories";

type Event = PublicLiveEventRow;

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
  const [eventCategory, setEventCategory] = useState<MatchEventCategory | "All">("All");
  const [lineups, setLineups] = useState<FixtureLineup[]>([]);
  const [media, setMedia] = useState<MatchMediaItem[]>([]);
  const [mediaFilter, setMediaFilter] = useState<"all" | "photo" | "video">("all");
  const [mediaOffset, setMediaOffset] = useState(0);
  const [mediaHasMore, setMediaHasMore] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [mediaReload, setMediaReload] = useState(0);
  const [activeEmbed, setActiveEmbed] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<MatchMediaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const halftimeRequestFor = useRef<number | null>(null);

  useEffect(() => {
    if (!matchId) return;
    let active = true;
    setMedia([]); setMediaOffset(0); setMediaHasMore(false); setMediaError(""); setActiveEmbed(null);
    setMediaLoading(true);
    const query = new URLSearchParams({ type: mediaFilter, limit: "12", offset: "0" });
    fetch(`/api/public/matches/${matchId}/media?${query}`)
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "Unable to load match media."); return body; })
      .then((body) => { if (active) { setMedia(body.media || []); setMediaHasMore(Boolean(body.hasMore)); setMediaOffset(body.nextOffset || 0); } })
      .catch((cause) => { if (active) setMediaError(cause instanceof Error ? cause.message : "Unable to load match media."); })
      .finally(() => { if (active) setMediaLoading(false); });
    return () => { active = false; };
  }, [matchId, mediaFilter, mediaReload]);

  useEffect(() => {
    if (!matchId) return;
    let active = true;
    const loadLineups = () => fetch(`/api/public/matches/${matchId}/lineups`)
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "Unable to load verified lineups."); return body; })
      .then((body) => { if (active) setLineups(body.lineups || []); })
      .catch(() => { if (active) setLineups([]); });
    void loadLineups();
    const timer = setInterval(() => void loadLineups(), 30_000);
    return () => { active = false; clearInterval(timer); };
  }, [matchId]);

  async function loadMoreMedia() {
    if (!mediaHasMore || mediaLoading) return;
    setMediaLoading(true); setMediaError("");
    try {
      const query = new URLSearchParams({ type: mediaFilter, limit: "12", offset: String(mediaOffset) });
      const response = await fetch(`/api/public/matches/${matchId}/media?${query}`);
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Unable to load more media.");
      setMedia((current) => [...current, ...(body.media || [])]); setMediaHasMore(Boolean(body.hasMore)); setMediaOffset(body.nextOffset || mediaOffset);
    } catch (cause) { setMediaError(cause instanceof Error ? cause.message : "Unable to load more media."); }
    finally { setMediaLoading(false); }
  }

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
  const hasScore = match.status === "completed" || isLive;
  const targetTeamIds = [match.home_team_id, match.away_team_id].filter(
    (id): id is number => typeof id === "number"
  );
  const shareTitle = `${match.home_team_name} vs ${match.away_team_name}`;
  const shareText = hasScore
    ? `${match.home_team_name} ${match.home_score ?? 0}\u2013${match.away_score ?? 0} ${match.away_team_name} \u2014 live on LeagueForge`
    : `${match.home_team_name} vs ${match.away_team_name}${match.venue ? ` at ${match.venue}` : ""} \u2014 on LeagueForge`;
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

      <div className="flex flex-wrap items-center gap-2">
        <ShareMatchButton title={shareTitle} text={shareText} />
        {match.organization_id && targetTeamIds.length > 0 && (
          <FollowTeamsButton organizationId={match.organization_id} teamIds={targetTeamIds} />
        )}
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

      <section aria-labelledby="match-lineups-heading" className="space-y-3">
        <div className="px-1">
          <h2 id="match-lineups-heading" className="text-base font-bold">Verified lineups</h2>
          <p className="mt-0.5 text-xs text-ink-3">Starting XI, formation and substitutes</p>
        </div>
        {lineups.length ? <MatchLineupsDisplay
          teams={[
            { id: match.home_team_id ?? -1, name: match.home_team_name, logo_url: match.home_team_logo },
            { id: match.away_team_id ?? -2, name: match.away_team_name, logo_url: match.away_team_logo },
          ]}
          lineups={lineups}
        /> : <div className="card p-4 text-center text-sm text-muted">Lineups will appear here after they are submitted and verified.</div>}
      </section>

      <section aria-labelledby="match-media-heading" className="space-y-3">
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <h2 id="match-media-heading" className="text-base font-bold">Photos & highlights</h2>
              <p className="mt-0.5 text-xs text-ink-3">Match moments from {match.home_team_name} vs {match.away_team_name}</p>
            </div>
            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink-3">{media.length}{mediaHasMore ? "+" : ""}</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filter match media">
            {([ ["all", "All"], ["photo", "Photos"], ["video", "Videos"] ] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setMediaFilter(value)} aria-pressed={mediaFilter === value} className={`rounded-full px-3.5 py-2 text-xs font-semibold ${mediaFilter === value ? "bg-brand text-white" : "border border-line bg-surface text-ink-3"}`}>{label}</button>)}
          </div>
          {mediaError && <div role="alert" className="card flex items-center justify-between gap-3 p-3 text-sm text-danger"><span>{mediaError}</span><button type="button" onClick={() => setMediaReload((current) => current + 1)} className="btn">Retry</button></div>}
          {mediaLoading && media.length === 0 ? <div className="card p-5 text-center text-sm text-muted">Loading match media…</div> : null}
          {!mediaLoading && media.length === 0 && !mediaError ? <div className="card p-5 text-center text-sm text-muted">No {mediaFilter === "all" ? "photos or highlights" : mediaFilter === "photo" ? "photos" : "videos"} have been shared for this match yet.</div> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {media.map((item) => (
              <article key={item.id} className="card overflow-hidden">
                {item.media_type === "photo" ? (
                  <button type="button" onClick={() => setSelectedPhoto(item)} className="block w-full" aria-label={`Open photo: ${item.alt_text || item.title}`}><Image src={item.url} alt={item.alt_text || item.title || "Match photo"} width={item.width || 960} height={item.height || 540} sizes="(max-width: 640px) 100vw, 50vw" loading="lazy" className="aspect-video w-full object-cover" /></button>
                ) : item.embed_url ? (
                  activeEmbed === item.id ? <iframe src={`${item.embed_url}?autoplay=1`} title={item.title || "Match highlight"} className="aspect-video w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /> : <button type="button" onClick={() => setActiveEmbed(item.id)} className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-surface-2" aria-label={`Play ${item.title || "match highlight"}`}>
                    {item.thumbnail_url ? <Image src={item.thumbnail_url} alt="" fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" /> : item.embed_url.includes("youtube-nocookie.com/embed/") ? <img src={`https://img.youtube.com/vi/${item.embed_url.split("/").pop()}/hqdefault.jpg`} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" /> : null}
                    <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-black/70 text-white"><Play size={20} fill="currentColor" /></span>
                  </button>
                ) : (
                  <video src={item.url} poster={item.thumbnail_url || undefined} controls preload="none" playsInline className="aspect-video w-full bg-black" />
                )}
                {(item.title || item.caption) && <div className="p-3.5"><h3 className="text-sm font-semibold">{item.title}</h3>{item.caption && <p className="mt-1 text-sm text-ink-3">{item.caption}</p>}</div>}
              </article>
            ))}
          </div>
          {mediaHasMore && <button type="button" onClick={() => void loadMoreMedia()} disabled={mediaLoading} className="btn w-full">{mediaLoading ? "Loading…" : <><ChevronDown size={15} /> Load more</>}</button>}
        </section>
      {selectedPhoto && <div role="dialog" aria-modal="true" aria-label={selectedPhoto.alt_text || selectedPhoto.title || "Match photo"} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" onClick={() => setSelectedPhoto(null)}><button type="button" onClick={() => setSelectedPhoto(null)} aria-label="Close photo" className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white"><X size={22} /></button><Image src={selectedPhoto.url} alt={selectedPhoto.alt_text || selectedPhoto.title || "Match photo"} width={selectedPhoto.width || 1600} height={selectedPhoto.height || 900} sizes="100vw" className="max-h-[90vh] w-auto max-w-full object-contain" onClick={(event) => event.stopPropagation()} /></div>}

      <section aria-labelledby="match-timeline-heading" className="space-y-4">
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <h2 id="match-timeline-heading" className="text-base font-bold">Match timeline</h2>
            <p className="mt-0.5 text-xs text-ink-3">Events grouped by type for a clear match record</p>
          </div>
          {liveEvents.length > 0 && <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink-3">{liveEvents.length} updates</span>}
        </div>
        {liveEvents.length > 0 ? <>
          <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filter events by category">
            {(["All", ...MATCH_EVENT_CATEGORIES] as const).map((category) => {
              const count = category === "All" ? liveEvents.length : liveEvents.filter((event) => matchEventCategory(event.event_type) === category).length;
              if (category !== "All" && count === 0) return null;
              const selected = eventCategory === category;
              return <button key={category} type="button" onClick={() => setEventCategory(category)} aria-pressed={selected} className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${selected ? "bg-brand text-white" : "border border-line bg-surface text-ink-3 hover:bg-surface-2"}`}>{category} <span className="ml-1 opacity-75">{count}</span></button>;
            })}
          </div>
          {(eventCategory === "All" ? MATCH_EVENT_CATEGORIES : [eventCategory]).map((category) => {
            const categorized = liveEvents.filter((event) => matchEventCategory(event.event_type) === category);
            if (!categorized.length) return null;
            return <section key={category} aria-label={`${category} events`} className="space-y-2.5">
              <div className="flex items-center justify-between px-1"><h3 className="text-sm font-bold">{category}</h3><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${matchEventCategoryColor(category)}`}>{categorized.length}</span></div>
              <div className="space-y-2">{categorized.map((event) => (
                <article key={event.event_id} className="card flex items-center gap-3 border-l-2 border-l-brand/40 p-3.5 sm:gap-4 sm:p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-sm font-bold text-ink-3">{event.player_name?.slice(0, 1) || "•"}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug">{eventLabel(event, match.home_team_name, match.away_team_name)}</p>
                    <p className="mt-1 text-xs text-ink-3">{event.team_id === event.home_team_id ? match.home_team_name : match.away_team_name}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${eventTone(event.event_type)}`}>{event.event_type.replace(/[-_]/g, " ")}</span>
                  {event.minute != null && <span className="min-w-8 shrink-0 text-right text-sm font-semibold tabular-nums text-ink-2">{event.minute}′</span>}
                </article>
              ))}</div>
            </section>;
          })}
        </> : (
          <div className="card p-5 text-center text-sm text-muted">
            {isLive ? "Match is underway. Updates will appear here as they happen." : "No player events have been recorded for this match."}
          </div>
        )}
      </section>
    </div>
  );
}
