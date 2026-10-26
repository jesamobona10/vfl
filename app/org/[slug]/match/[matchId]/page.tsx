"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Image as ImageIcon, ListOrdered, Radio, Users } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useCan } from "@/lib/hooks/use-can";
import { useCompetition } from "@/lib/hooks/use-competitions";
import { MatchMode } from "@/components/match/match-mode";
import { FixtureLineupsModal } from "@/components/fixtures/fixture-lineups";
import { MatchMediaManager } from "@/components/fixtures/match-media-manager";
import { EmptyState, LoadingState } from "@/components/shared/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { liveSettings } from "@/lib/logic/live";
import { matchStatusVariant, statusLabel } from "@/lib/status";
import type { Match, Team } from "@/lib/types";

type WorkspaceSection = "overview" | "events" | "lineups" | "media";
const WORKSPACE_SECTIONS: { id: WorkspaceSection; label: string; icon: typeof CalendarDays }[] = [
  { id: "overview", label: "Overview", icon: CalendarDays },
  { id: "events", label: "Live events", icon: ListOrdered },
  { id: "lineups", label: "Lineups", icon: Users },
  { id: "media", label: "Media", icon: ImageIcon },
];

interface FixtureResponse {
  match: Match;
  organizationId: string | null;
  homeTeam: Team | null;
  awayTeam: Team | null;
}

export default function MatchWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const matchId = Number(params.matchId);

  const { allowed: canEdit } = useCan("match.edit");
  const setPlayers = useAppStore((s) => s.setPlayers);
  const setTeams = useAppStore((s) => s.setTeams);
  const setFixtures = useAppStore((s) => s.setFixtures);
  const setCurrentSeasonId = useAppStore((s) => s.setCurrentSeasonId);

  const [homeTeam, setHomeTeamLocal] = useState<Team | undefined>();
  const [awayTeam, setAwayTeamLocal] = useState<Team | undefined>();
  const [competitionId, setCompetitionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<WorkspaceSection>("overview");
  const [lineupsOpen, setLineupsOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);

  // The live match is read from the store so every write through the
  // match-events seam (score, events, status) re-renders this screen.
  const match = useAppStore((s) =>
    s.fixtures.flatMap((r) => r.matches).find((m) => m.id === matchId)
  );

  const { data: competition } = useCompetition(competitionId ?? undefined);
  const settings = useMemo(
    () => (competition ? liveSettings(competition.settings) : undefined),
    [competition]
  );

  useEffect(() => {
    if (!Number.isFinite(matchId)) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/fixtures/${matchId}`);
        const body = await res.json().catch(() => null);
        if (!res.ok || !body) {
          if (!cancelled) setError(body?.error || "Unable to load the match.");
          return;
        }
        const data = body as FixtureResponse;
        if (cancelled) return;

        setHomeTeamLocal(data.homeTeam ?? undefined);
        setAwayTeamLocal(data.awayTeam ?? undefined);
        setCompetitionId(data.match.competition_id ?? null);

        // Bridge into the shared store so the seam can mutate the match and
        // the add-event modal can read the two teams' players.
        setTeams([data.homeTeam, data.awayTeam].filter(Boolean) as Team[]);
        setFixtures([{ round: data.match.round, byeId: null, matches: [data.match] }]);
        setCurrentSeasonId(data.match.season_id ?? null);

        if (data.organizationId) {
          const playersRes = await fetch(`/api/players?org_id=${data.organizationId}`);
          const playersBody = await playersRes.json().catch(() => null);
          if (!cancelled && playersRes.ok && Array.isArray(playersBody?.players)) {
            setPlayers(playersBody.players);
          }
        }
      } catch {
        if (!cancelled) setError("Unable to load the match.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId, setTeams, setFixtures, setPlayers, setCurrentSeasonId]);

  if (!Number.isFinite(matchId)) {
    return <EmptyState title="Match unavailable" description="Invalid match." />;
  }

  if (!canEdit) {
    return (
      <EmptyState
        title="Match workspace is restricted"
        description="You do not have permission to manage this match."
      />
    );
  }

  if (loading && !match) {
    return <LoadingState label="Loading match" />;
  }

  if (error || !match) {
    return (
      <EmptyState
        title="Match unavailable"
        description={error || "This match could not be found."}
      />
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft size={16} />
        Back to matches
      </button>

      <header className="card space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs text-muted">Round {match.round} · Match {match.id}</p><h1 className="mt-1 text-lg font-bold">Match workspace</h1></div>
          <Badge variant={matchStatusVariant(match.status)} dot={match.status === "live" || match.status === "in-progress"} pulse={match.status === "live" || match.status === "in-progress"}>{statusLabel(match.status)}</Badge>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center sm:gap-4">
          <div className="min-w-0"><p className="truncate text-sm font-semibold sm:text-base">{homeTeam?.name || "Home"}</p><p className="mt-1 text-2xl font-bold tabular-nums">{match.homeScore ?? "—"}</p></div>
          <span className="text-xs font-semibold uppercase tracking-widest text-muted">vs</span>
          <div className="min-w-0"><p className="truncate text-sm font-semibold sm:text-base">{awayTeam?.name || "Away"}</p><p className="mt-1 text-2xl font-bold tabular-nums">{match.awayScore ?? "—"}</p></div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted"><span>{match.date || "Date not set"}{match.time ? ` · ${match.time}` : ""}</span><span>{match.venue || "Venue not set"}</span></div>
      </header>

      <nav aria-label="Match workspace" className="flex gap-2 overflow-x-auto rounded-xl border border-line bg-surface p-2">
        {WORKSPACE_SECTIONS.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setSection(id)} aria-current={section === id ? "page" : undefined} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold ${section === id ? "bg-brand text-white" : "text-muted hover:bg-surface-2 hover:text-ink"}`}><Icon size={15} />{label}</button>)}
      </nav>

      {section === "overview" && <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <button type="button" onClick={() => setSection("events")} className="card flex min-h-28 items-start gap-3 p-4 text-left hover:border-brand/40"><span className="rounded-lg bg-brand/10 p-2 text-brand"><Radio size={17} /></span><span><strong className="block text-sm">Match events</strong><span className="mt-1 block text-xs text-muted">{match.events?.length || 0} events · record or correct the live timeline</span></span></button>
        <button type="button" onClick={() => setLineupsOpen(true)} className="card flex min-h-28 items-start gap-3 p-4 text-left hover:border-brand/40"><span className="rounded-lg bg-brand/10 p-2 text-brand"><Users size={17} /></span><span><strong className="block text-sm">Lineups</strong><span className="mt-1 block text-xs text-muted">View, submit, or review lineups using the existing lineup workflow</span></span></button>
        <button type="button" onClick={() => setMediaOpen(true)} className="card flex min-h-28 items-start gap-3 p-4 text-left hover:border-brand/40"><span className="rounded-lg bg-brand/10 p-2 text-brand"><ImageIcon size={17} /></span><span><strong className="block text-sm">Match media</strong><span className="mt-1 block text-xs text-muted">Open the existing photo, video, and highlight manager</span></span></button>
      </section>}

      {section === "events" && <MatchMode match={match} homeTeam={homeTeam} awayTeam={awayTeam} settings={settings} onUpdated={() => {}} />}
      {section === "lineups" && <section className="card space-y-3 p-5"><h2 className="font-semibold">Lineups and formation</h2><p className="text-sm text-muted">Review the submitted teams or manage a lineup through the existing fixture workflow.</p><Button onClick={() => setLineupsOpen(true)} leftIcon={<Users size={15} />}>Open lineup manager</Button></section>}
      {section === "media" && <section className="card space-y-3 p-5"><h2 className="font-semibold">Photos, videos and highlights</h2><p className="text-sm text-muted">Manage media attached to this fixture using the existing upload and moderation flow.</p><Button onClick={() => setMediaOpen(true)} leftIcon={<ImageIcon size={15} />}>Open media manager</Button></section>}

      <FixtureLineupsModal fixtureId={match.id} open={lineupsOpen} onClose={() => setLineupsOpen(false)} />
      <MatchMediaManager matchId={match.id} homeTeamName={homeTeam?.name || "Home"} awayTeamName={awayTeam?.name || "Away"} open={mediaOpen} onClose={() => setMediaOpen(false)} />
    </div>
  );
}
