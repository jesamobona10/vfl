"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BarChart3, CalendarClock, MapPin, Radio, Settings2, Trophy } from "lucide-react";
import { createPublicClient } from "@/lib/supabase/public";
import type { PublicMatchRow, PublicPlayerStatisticsRow, PublicSeasonRow, PublicStandingRow } from "@/lib/types";
import { PushSubscriptionControl } from "@/components/public/push-subscription";
import { Modal } from "@/components/ui/modal";
import { readPublicPreferences, savePublicPreferences, type PublicPreferences } from "@/lib/public-preferences";
import { useAppStore } from "@/lib/store";
import { livePhase, liveSettings } from "@/lib/logic/live";

type MatchFilter = "all" | "scheduled" | "live" | "halftime" | "completed";
type PublicSection = "matches" | "standings" | "players";

interface PublicCompetitionOption {
  competitionId: string;
  label: string;
}

interface PublicSeasonOption {
  key: string;
  label: string;
  seasonIds: string[];
  isCurrent: boolean;
}

const FILTERS: Array<{ key: MatchFilter; label: string }> = [
  { key: "all", label: "All matches" },
  { key: "scheduled", label: "Scheduled" },
  { key: "live", label: "Live" },
  { key: "halftime", label: "Half-time" },
  { key: "completed", label: "Full-time" },
];

function matchCategory(match: PublicMatchRow, now: number): Exclude<MatchFilter, "all"> {
  if (match.status === "live" || match.status === "in-progress") {
    if (match.live_started_at && livePhase(match.live_started_at, now, liveSettings({
      halftimeMinutes: match.halftime_minutes,
      stoppageMinutes: match.stoppage_minutes,
    })).label === "HT") return "halftime";
    return "live";
  }
  if (match.status === "completed") return "completed";
  return "scheduled";
}

function statusLabel(category: Exclude<MatchFilter, "all">) {
  if (category === "live") return "LIVE";
  if (category === "halftime") return "HALF-TIME";
  if (category === "completed") return "FULL-TIME";
  return "SCHEDULED";
}

function statusBadgeClass(category: Exclude<MatchFilter, "all">) {
  if (category === "live") {
    return "bg-danger/15 text-danger border-danger/30 animate-pulse";
  }
  if (category === "halftime") return "bg-warn-500/15 text-warn-700 border-warn-500/30";
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

function ReminderChoices({ value, onChange }: { value: number[]; onChange: (value: number[]) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold text-ink-2">Pre-match reminders</legend>
      <p className="text-xs text-ink-3">Get a push notification before scheduled fixtures.</p>
      <div className="flex flex-wrap gap-2">
        {[60, 30, 15].map((minutes) => (
          <label key={minutes} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs">
            <input
              type="checkbox"
              checked={value.includes(minutes)}
              onChange={(event) => onChange(event.target.checked ? [...value, minutes] : value.filter((item) => item !== minutes))}
            />
            {minutes >= 60 ? "1 hour" : `${minutes} minutes`}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function PublicDashboard() {
  const authLoading = useAppStore((state) => state.authLoading);
  const isAdmin = useAppStore((state) => state.isAdmin);
  const currentTeamAccount = useAppStore((state) => state.currentTeamAccount);
  const userProfile = useAppStore((state) => state.userProfile);
  const authenticated = isAdmin || Boolean(currentTeamAccount) || userProfile?.role === "player" || userProfile?.role === "org_admin";
  const [matches, setMatches] = useState<PublicMatchRow[]>([]);
  const [publicSeasons, setPublicSeasons] = useState<PublicSeasonRow[]>([]);
  const [filter, setFilter] = useState<MatchFilter>("all");
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [section, setSection] = useState<PublicSection>("matches");
  const [selectedCompetitionKey, setSelectedCompetitionKey] = useState("");
  const [selectedPublicSeasonKey, setSelectedPublicSeasonKey] = useState(() => {
    if (typeof window === "undefined") return "";
    const savedPreferences = readPublicPreferences();
    return savedPreferences ? localStorage.getItem(`vfl-public-season-${savedPreferences.organizationId}`) || "" : "";
  });
  const [standings, setStandings] = useState<PublicStandingRow[]>([]);
  const [playerStatistics, setPlayerStatistics] = useState<PublicPlayerStatisticsRow[]>([]);
  const [loadedStatsKey, setLoadedStatsKey] = useState("");
  const [statsError, setStatsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<PublicPreferences | null>(() => typeof window === "undefined" ? null : readPublicPreferences());
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [draftName, setDraftName] = useState(() => typeof window === "undefined" ? "" : readPublicPreferences()?.displayName || "");
  const [draftOrganizationId, setDraftOrganizationId] = useState(() => typeof window === "undefined" ? "" : readPublicPreferences()?.organizationId || "");
  const [draftTeamIds, setDraftTeamIds] = useState<number[]>(() => typeof window === "undefined" ? [] : readPublicPreferences()?.teamIds || []);
  const [draftReminderMinutes, setDraftReminderMinutes] = useState<number[]>(() => typeof window === "undefined" ? [60, 30, 15] : readPublicPreferences()?.reminderMinutes || [60, 30, 15]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    let mounted = true;
    const loadPreferences = async () => {
      if (authenticated) {
        try {
          const response = await fetch("/api/public/preferences", { cache: "no-store" });
          if (response.ok) {
            const body = await response.json();
            if (mounted) {
              if (!body.preferences) {
                setPreferences(null);
                setPreferencesReady(true);
                return;
              }
              setPreferences(body.preferences);
              setDraftName(body.preferences.displayName || "");
              setDraftOrganizationId(body.preferences.organizationId || "");
              setDraftTeamIds(body.preferences.teamIds || []);
              setDraftReminderMinutes(body.preferences.reminderMinutes || [60, 30, 15]);
              setSelectedPublicSeasonKey(localStorage.getItem(`vfl-public-season-${body.preferences.organizationId}`) || "");
              savePublicPreferences(body.preferences);
            }
          }
        } catch {
          if (mounted) setPreferencesError("Could not load your saved match preferences.");
        }
      } else {
        const saved = readPublicPreferences();
        if (mounted && saved) {
          setPreferences(saved);
          setDraftName(saved.displayName);
          setDraftOrganizationId(saved.organizationId);
          setDraftTeamIds(saved.teamIds);
          setDraftReminderMinutes(saved.reminderMinutes || [60, 30, 15]);
          setSelectedPublicSeasonKey(localStorage.getItem(`vfl-public-season-${saved.organizationId}`) || "");
        }
      }
      if (mounted) setPreferencesReady(true);
    };
    void loadPreferences();
    return () => { mounted = false; };
  }, [authLoading, authenticated]);

  useEffect(() => {
    const sb = createPublicClient();
    let mounted = true;

    async function load() {
      const [{ data, error }, { data: seasonRows, error: seasonError }] = await Promise.all([
        sb
          .from("public_matches")
          .select("*")
          .order("date", { ascending: false, nullsFirst: false })
          .order("time", { ascending: true, nullsFirst: false })
          .order("round", { ascending: true })
          .order("match_id", { ascending: true }),
        sb.from("public_seasons").select("*").order("season_name", { ascending: false }),
      ]);

      if (!mounted) return;
      if (error) {
        setError(error.message);
      } else {
        setMatches((data as PublicMatchRow[]) || []);
        setError(null);
      }
      if (!seasonError) setPublicSeasons((seasonRows as PublicSeasonRow[]) || []);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "seasons" }, () => {
        if (mounted) load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "organization_seasons" }, () => {
        if (mounted) load();
      })
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

  const organizations = useMemo(() => {
    const options = new Map<string, string>();
    for (const match of matches) {
      if (match.organization_id && match.organization_name) options.set(match.organization_id, match.organization_name);
    }
    return [...options].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [matches]);
  const publicSeasonOptions = useMemo(() => {
    const options = new Map<string, PublicSeasonOption>();
    for (const season of publicSeasons) {
      if (season.organization_id !== preferences?.organizationId) continue;
      const key = season.organization_season_id || `legacy:${season.season_id}`;
      const current = options.get(key);
      if (current) {
        current.seasonIds.push(season.season_id);
        current.isCurrent ||= season.is_current;
      } else {
        options.set(key, {
          key,
          label: season.season_name,
          seasonIds: [season.season_id],
          isCurrent: season.is_current,
        });
      }
    }
    return [...options.values()].sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || b.label.localeCompare(a.label));
  }, [publicSeasons, preferences?.organizationId]);
  const activePublicSeason = selectedPublicSeasonKey === "all"
    ? null
    : publicSeasonOptions.find((option) => option.key === selectedPublicSeasonKey)
      || publicSeasonOptions.find((option) => option.isCurrent)
      || publicSeasonOptions[0]
      || null;
  const activePublicSeasonKey = selectedPublicSeasonKey === "all" ? "all" : activePublicSeason?.key || "all";
  const availableTeams = useMemo(() => {
    const teams = new Map<number, string>();
    for (const match of matches) {
      if (match.organization_id !== draftOrganizationId) continue;
      if (match.home_team_id) teams.set(match.home_team_id, match.home_team_name);
      if (match.away_team_id) teams.set(match.away_team_id, match.away_team_name);
    }
    return [...teams].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [matches, draftOrganizationId]);
  const preferenceIsValid = Boolean(preferences && organizations.some((organization) => organization.id === preferences.organizationId));
  const organizationMatches = useMemo(() => {
    if (!preferenceIsValid || !preferences) return [];
    return matches.filter((match) => match.organization_id === preferences.organizationId);
  }, [matches, preferences, preferenceIsValid]);
  const seasonMatches = useMemo(() => {
    if (activePublicSeasonKey === "all") return organizationMatches;
    const seasonIds = new Set(activePublicSeason?.seasonIds || []);
    return organizationMatches.filter((match) => match.season_id != null && seasonIds.has(match.season_id));
  }, [organizationMatches, activePublicSeason, activePublicSeasonKey]);
  const counts = useMemo(() => {
    const result: Record<MatchFilter, number> = { all: seasonMatches.length, scheduled: 0, live: 0, halftime: 0, completed: 0 };
    for (const match of seasonMatches) result[matchCategory(match, clockNow)] += 1;
    return result;
  }, [seasonMatches, clockNow]);

  const competitionOptions = useMemo(() => {
    const options = new Map<string, PublicCompetitionOption>();
    for (const match of organizationMatches) {
      if (!match.competition_id || options.has(match.competition_id)) continue;
      options.set(match.competition_id, {
        competitionId: match.competition_id,
        label: match.competition_name || "Competition",
      });
    }
    return [...options.values()];
  }, [organizationMatches]);

  const activeCompetition = competitionOptions.find((option) => option.competitionId === selectedCompetitionKey)
    || competitionOptions[0]
    || null;
  const activeCompetitionId = activeCompetition?.competitionId || "";
  const activeCompetitionSeasonId = activePublicSeason?.seasonIds
    .map((seasonId) => publicSeasons.find((season) => season.season_id === seasonId && season.competition_id === activeCompetitionId)?.season_id)
    .find((seasonId): seasonId is string => Boolean(seasonId)) || null;
  const activeStatsKey = `${activeCompetitionId}:${activePublicSeasonKey}`;
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

      if (activePublicSeasonKey !== "all") {
        if (!activeCompetitionSeasonId) {
          setStandings([]);
          setPlayerStatistics([]);
          setStatsError(null);
          setLoadedStatsKey(activeStatsKey);
          return;
        }
        standingsQuery = standingsQuery.eq("season_id", activeCompetitionSeasonId);
        playerStatsQuery = playerStatsQuery.eq("season_id", activeCompetitionSeasonId);
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
      setLoadedStatsKey(activeStatsKey);
    }

    void loadStats();
    const refresh = () => void loadStats();
    const channel = sb
      .channel(`public-statistics-${activeStatsKey}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "fixtures" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_events" }, refresh)
      .subscribe();
    const poll = setInterval(refresh, 30000);

    return () => {
      mounted = false;
      clearInterval(poll);
      void sb.removeChannel(channel);
    };
  }, [activeCompetitionId, activeCompetitionSeasonId, activePublicSeasonKey, activeStatsKey, section]);

  const visibleMatches = useMemo(() => {
    const selected =
      filter === "all"
        ? seasonMatches
        : seasonMatches.filter((match) => matchCategory(match, clockNow) === filter);

    return [...selected].sort((a, b) => {
      const rank = (match: PublicMatchRow) =>
        matchCategory(match, clockNow) === "live" || matchCategory(match, clockNow) === "halftime"
          ? 0
          : matchCategory(match, clockNow) === "scheduled"
            ? 1
            : 2;
      const statusOrder = rank(a) - rank(b);
      if (statusOrder !== 0) return statusOrder;
      if (matchCategory(a, clockNow) === "completed") {
        return (b.date || "").localeCompare(a.date || "");
      }
      return `${a.date || ""} ${a.time || ""}`.localeCompare(`${b.date || ""} ${b.time || ""}`);
    });
  }, [filter, seasonMatches, clockNow]);

  const savePreferences = async () => {
    if (!draftOrganizationId) return;
    const next: PublicPreferences = {
      displayName: draftName.trim().slice(0, 80),
      organizationId: draftOrganizationId,
      teamIds: [...new Set(draftTeamIds)].filter((id) => availableTeams.some((team) => team.id === id)),
      reminderMinutes: [...new Set(draftReminderMinutes)].filter((value) => [60, 30, 15].includes(value)),
    };
    setPreferencesSaving(true);
    setPreferencesError(null);
    try {
      if (authenticated) {
        const response = await fetch("/api/public/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "Could not save your preferences.");
      }
      savePublicPreferences(next);
      setPreferences(next);
      setPreferencesOpen(false);
      setFilter("all");
      setSelectedCompetitionKey("");
      setSelectedPublicSeasonKey(localStorage.getItem(`vfl-public-season-${next.organizationId}`) || "");
    } catch (error) {
      setPreferencesError(error instanceof Error ? error.message : "Could not save your preferences.");
    } finally {
      setPreferencesSaving(false);
    }
  };

  if (!preferencesReady || loading && !preferences) {
    return <div className="mx-auto max-w-4xl p-6 text-center text-sm text-muted">Loading your match centre…</div>;
  }

  if (!preferenceIsValid) {
    return (
      <div className="mx-auto max-w-xl space-y-5 p-4 py-10 sm:p-6 sm:py-16">
        <div className="card space-y-5 p-5 sm:p-7">
          <div><span className="text-xs font-bold uppercase tracking-widest text-brand">Personalize match updates</span><h1 className="mt-2 text-2xl font-bold">Choose what you follow</h1><p className="mt-2 text-sm text-ink-3">Select an organization and optionally one or more teams. This public page stays available without an account.</p></div>
          {error || preferencesError ? <p className="text-sm text-danger">{error || preferencesError}</p> : (
            <>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-ink-2">Your name <span className="font-normal text-ink-3">(optional)</span></span><input className="input w-full" maxLength={80} value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="How should we address you?" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-ink-2">Organization</span><select className="input w-full" value={draftOrganizationId} onChange={(event) => { setDraftOrganizationId(event.target.value); setDraftTeamIds([]); }}><option value="">Choose an organization</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>
              {draftOrganizationId && <fieldset className="space-y-2"><legend className="mb-2 text-xs font-semibold text-ink-2">Teams <span className="font-normal text-ink-3">(leave all unchecked to follow every team)</span></legend><div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-line p-2">{availableTeams.map((team) => <label key={team.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-surface-2"><input type="checkbox" checked={draftTeamIds.includes(team.id)} onChange={(event) => setDraftTeamIds((current) => event.target.checked ? [...current, team.id] : current.filter((id) => id !== team.id))} />{team.name}</label>)}</div></fieldset>}
              <ReminderChoices value={draftReminderMinutes} onChange={setDraftReminderMinutes} />
              <button type="button" className="btn-primary w-full" disabled={!draftOrganizationId || preferencesSaving} onClick={() => void savePreferences()}>{preferencesSaving ? "Saving…" : "Save preferences and continue"}</button>
            </>
          )}
        </div>
      </div>
    );
  }

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
            <p className="text-2xl font-bold tabular-nums">{counts.live + counts.halftime}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">Live now</p>
          </div>
        </div>
      </header>

      <label className="block max-w-sm">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-3">Season</span>
        <select
          value={activePublicSeasonKey}
          onChange={(event) => {
            setSelectedPublicSeasonKey(event.target.value);
            if (preferences) {
              if (event.target.value === "all") localStorage.removeItem(`vfl-public-season-${preferences.organizationId}`);
              else localStorage.setItem(`vfl-public-season-${preferences.organizationId}`, event.target.value);
            }
          }}
          className="input w-full"
          aria-label="Select season"
        >
          <option value="all">All seasons</option>
          {publicSeasonOptions.map((option) => (
            <option key={option.key} value={option.key}>{option.label}{option.isCurrent ? " · Current" : ""}</option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2/40 px-3 py-2.5">
        <p className="text-xs text-ink-2">{preferences?.displayName ? `Hi ${preferences.displayName} · ` : "Following "}{organizations.find((organization) => organization.id === preferences?.organizationId)?.name}{preferences?.teamIds.length ? ` · ${preferences.teamIds.map((id) => availableTeams.find((team) => team.id === id)?.name).filter(Boolean).join(", ")}` : " · all teams"}</p>
        <button type="button" className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs" onClick={() => { setDraftName(preferences?.displayName || ""); setDraftOrganizationId(preferences?.organizationId || ""); setDraftTeamIds(preferences?.teamIds || []); setDraftReminderMinutes(preferences?.reminderMinutes || [60, 30, 15]); setPreferencesError(null); setPreferencesOpen(true); }}><Settings2 size={14} /> Change preferences</button>
      </div>
      <PushSubscriptionControl preferences={preferences!} />
      <Modal open={preferencesOpen} onClose={() => setPreferencesOpen(false)} title="Your match updates" subtitle="Choose which match centre to follow and which alerts you want." footer={<div className="flex justify-end gap-2"><button type="button" className="btn-secondary px-4 py-2 text-sm" onClick={() => setPreferencesOpen(false)}>Cancel</button><button type="button" className="btn-primary px-4 py-2 text-sm" disabled={!draftOrganizationId || preferencesSaving} onClick={() => void savePreferences()}>{preferencesSaving ? "Saving…" : "Save preferences"}</button></div>}>
        <div className="space-y-4">
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-ink-2">Your name <span className="font-normal text-ink-3">(optional)</span></span><input className="input w-full" maxLength={80} value={draftName} onChange={(event) => setDraftName(event.target.value)} /></label>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-ink-2">Organization</span><select className="input w-full" value={draftOrganizationId} onChange={(event) => { setDraftOrganizationId(event.target.value); setDraftTeamIds([]); }}><option value="">Choose an organization</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>
          {draftOrganizationId && <fieldset className="space-y-2"><legend className="mb-2 text-xs font-semibold text-ink-2">Teams <span className="font-normal text-ink-3">(leave all unchecked to follow every team)</span></legend><div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-line p-2">{availableTeams.map((team) => <label key={team.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-surface-2"><input type="checkbox" checked={draftTeamIds.includes(team.id)} onChange={(event) => setDraftTeamIds((current) => event.target.checked ? [...current, team.id] : current.filter((id) => id !== team.id))} />{team.name}</label>)}</div></fieldset>}
          <ReminderChoices value={draftReminderMinutes} onChange={setDraftReminderMinutes} />
          {preferencesError && <p className="text-sm text-danger" role="alert">{preferencesError}</p>}
        </div>
      </Modal>

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
                value={activeCompetitionId}
                onChange={(event) => setSelectedCompetitionKey(event.target.value)}
                className="input w-full"
                aria-label="Select competition and season"
              >
                {competitionOptions.map((option) => (
                  <option key={option.competitionId} value={option.competitionId}>{option.label}</option>
                ))}
              </select>
            </label>
          )}

          {competitionOptions.length === 0 ? (
            <div className="card p-6 text-center text-sm text-muted">Standings and player statistics will appear when public competition matches are available.</div>
          ) : loadedStatsKey !== activeStatsKey ? (
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
            const category = matchCategory(match, clockNow);
            const livePhaseNow = match.live_started_at
              ? livePhase(match.live_started_at, clockNow, liveSettings({
                  halftimeMinutes: match.halftime_minutes,
                  stoppageMinutes: match.stoppage_minutes,
                }))
              : null;
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
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wide ${statusBadgeClass(category)}`}>
                    {category === "live" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
                    {statusLabel(category)}{category === "live" && livePhaseNow ? ` · ${livePhaseNow.minute}${livePhaseNow.stoppage ? ` ${livePhaseNow.stoppage}` : ""}′` : ""}
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

export default PublicDashboard;
