"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Activity, CalendarDays, CheckCircle2, Clock3, ListFilter, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useOrgSeason } from "@/components/competitions/org-season-provider";
import { useOrgSeasonFixtures, useCompetitions } from "@/lib/hooks/use-competitions";
import { useOrg } from "@/lib/hooks/use-org";
import { useCan } from "@/lib/hooks/use-can";
import { fixtureMatchesMatchdayView, getMatchdayViewCounts, type MatchdayView } from "@/lib/logic/matchday";
import { FixtureCard } from "@/components/fixtures/fixture-card";
import { EmptyState, LoadingState } from "@/components/shared/skeleton";
import { Button } from "@/components/ui/button";

const VIEWS: { id: MatchdayView; label: string; icon: typeof CalendarDays }[] = [
  { id: "today", label: "Today", icon: CalendarDays },
  { id: "live", label: "Live", icon: Activity },
  { id: "needs_action", label: "Needs action", icon: ShieldAlert },
  { id: "upcoming", label: "Upcoming", icon: Clock3 },
  { id: "completed", label: "Recently completed", icon: CheckCircle2 },
];

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function MatchdayPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { data: organization } = useOrg(slug);
  const { data: competitions = [] } = useCompetitions(organization?.id);
  const { selectedOrgSeasonId, selectedSeasonName, isOrgAdmin } = useOrgSeason();
  const { allowed: canEditFixtures } = useCan("fixtures.edit");
  const teams = useAppStore((state) => state.teams);
  const { data: rounds = [], isLoading, isError, error, refetch } = useOrgSeasonFixtures(slug, selectedOrgSeasonId ?? undefined);
  const [view, setView] = useState<MatchdayView>("today");
  const [competitionId, setCompetitionId] = useState("all");
  const [search, setSearch] = useState("");
  const today = localDateKey(new Date());
  const allMatches = useMemo(() => rounds.flatMap((round) => round.matches), [rounds]);
  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const competitionById = useMemo(() => new Map(competitions.map((competition) => [competition.id, competition.name])), [competitions]);
  const counts = useMemo(() => getMatchdayViewCounts(allMatches, today), [allMatches, today]);
  const visibleMatches = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allMatches
      .filter((match) => fixtureMatchesMatchdayView(match, view, today))
      .filter((match) => competitionId === "all" || match.competition_id === competitionId)
      .filter((match) => {
        if (!term) return true;
        const homeName = teamById.get(match.homeId)?.name ?? "";
        const awayName = teamById.get(match.awayId)?.name ?? "";
        return `${homeName} ${awayName} ${match.round} ${match.id}`.toLowerCase().includes(term);
      })
      .sort((a, b) => {
        if (view === "live") return (b.live_started_at || "").localeCompare(a.live_started_at || "");
        if (view === "completed") return `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`);
        return `${a.date || "9999-99-99"} ${a.time || "99:99"}`.localeCompare(`${b.date || "9999-99-99"} ${b.time || "99:99"}`);
      });
  }, [allMatches, view, today, competitionId, search, teamById]);

  if (!isOrgAdmin) {
    return <EmptyState title="Matchday is for organization staff" description="Your current account does not have access to the organization-wide matchday board." />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Organization matchday</p>
          <h1 className="mt-1 text-2xl font-bold">Matchday Hub</h1>
          <p className="mt-1 text-sm text-muted">Fixtures and match operations for {selectedSeasonName || "the selected season"}.</p>
        </div>
        <div className="rounded-xl border border-line bg-surface px-4 py-2 text-right">
          <p className="text-xs text-muted">Selected season</p>
          <p className="text-sm font-semibold">{selectedSeasonName || "No season selected"}</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Matchday views">
        {VIEWS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setView(id)} aria-pressed={view === id}
            className={`flex min-h-20 items-center justify-between gap-2 rounded-xl border px-3 py-3 text-left transition-colors ${view === id ? "border-brand bg-brand/10 text-brand" : "border-line bg-surface hover:bg-surface-2"}`}>
            <span className="min-w-0"><span className="flex items-center gap-2 text-xs font-semibold sm:text-sm"><Icon size={15} />{label}</span><span className="mt-1 block text-lg font-bold tabular-nums">{counts[id]}</span></span>
          </button>
        ))}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-xs font-medium text-muted">Search teams or round</span>
          <span className="relative block"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Team, round or match number" className="input w-full pl-9" /></span>
        </label>
        <label className="w-full sm:w-64">
          <span className="mb-1 block text-xs font-medium text-muted">Competition</span>
          <span className="relative block"><ListFilter size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><select value={competitionId} onChange={(event) => setCompetitionId(event.target.value)} className="input w-full pl-9"><option value="all">All competitions</option>{competitions.map((competition) => <option key={competition.id} value={competition.id}>{competition.name}</option>)}</select></span>
        </label>
      </section>

      {isLoading ? <LoadingState label="Loading matchday fixtures" /> : isError ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4"><p className="text-sm text-danger">{error instanceof Error ? error.message : "Could not load fixtures for this season."}</p><Button variant="secondary" size="sm" onClick={() => void refetch()} leftIcon={<RefreshCw size={14} />}>Retry</Button></div>
      ) : !selectedOrgSeasonId ? <EmptyState title="No season selected" description="Choose an organization season to view its matchday schedule." /> : !allMatches.length ? (
        <EmptyState title="No fixtures in this season" description="Fixtures added to this organization season will appear here." />
      ) : !visibleMatches.length ? <EmptyState title="No matches in this view" description="Try another matchday view, search term, or competition." /> : (
        <section aria-live="polite" aria-label={`${VIEWS.find((item) => item.id === view)?.label} matches`} className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {visibleMatches.map((match) => (
            <FixtureCard key={match.id} match={match} label={`Round ${match.round} · ${competitionById.get(match.competition_id || "") || "Competition"}`} homeTeam={teamById.get(match.homeId)} awayTeam={teamById.get(match.awayId)} editable={canEditFixtures} showDelete={false} onDrop={() => {}} />
          ))}
        </section>
      )}
    </div>
  );
}
