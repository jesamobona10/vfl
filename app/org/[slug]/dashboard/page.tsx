"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { useOrg } from "@/lib/hooks/use-org";
import { useCompetitions } from "@/lib/hooks/use-competitions";
import { MetricCards } from "@/components/dashboard/metric-cards";
import { LeagueStats } from "@/components/dashboard/league-stats";
import { UpcomingMatches } from "@/components/dashboard/upcoming-matches";
import { TopFiveStandings } from "@/components/dashboard/top-five-standings";
import { PlayerDashboard } from "@/components/player/player-dashboard";
import { Shield, RefreshCw, Loader2, Trophy, Swords, Users, Plus, ArrowRight } from "lucide-react";
import { GeneratePlayerCredentials } from "@/components/players/generate-player-credentials";
import { useParams, useRouter } from "next/navigation";

export default function OrgDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { data: currentOrg } = useOrg(slug);
  const { data: competitions = [] } = useCompetitions(currentOrg?.id);
  const teams = useAppStore((s) => s.teams);
  const players = useAppStore((s) => s.players);
  const isAdmin = useAppStore((s) => s.isAdmin);
  const isPlayer = useAppStore((s) => s.userProfile?.role === "player");
  const currentTeamAccount = useAppStore((s) => s.currentTeamAccount);
  const teamDataLoaded = useAppStore((s) => s.teamDataLoaded);
  const setTeamDataLoaded = useAppStore((s) => s.setTeamDataLoaded);
  const [fetching, setFetching] = useState(false);

  const teamId = currentTeamAccount?.teamId;
  const team = teams.find((t) => t.id === teamId);
  const teamPlayerCount = teamId
    ? players.filter((p) => p.teamId === teamId).length
    : 0;

  if (currentTeamAccount && !teamDataLoaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-muted" />
      </div>
    );
  }

  if (isPlayer) {
    return <PlayerDashboard />;
  }

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6">
        <div>
          <p className="text-sm text-muted">
            {currentOrg?.name || "Organization"}
          </p>
          <h1 className="text-2xl font-bold">
            {currentTeamAccount
              ? `${currentTeamAccount.name}`
              : "Dashboard"}
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {currentTeamAccount && (
            <button
              onClick={async () => {
                setTeamDataLoaded(false);
                setFetching(true);
                await refreshTeamData();
                setFetching(false);
              }}
              disabled={fetching}
              className="btn-ghost text-sm"
            >
              <RefreshCw size={16} className={fetching ? "animate-spin" : ""} />
              Refresh
            </button>
          )}
        </div>
      </div>

      {currentTeamAccount && team && (
        <>
          <div className="card p-5 mb-6 flex items-center gap-4">
            {team.logo ? (
              <img
                src={team.logo}
                alt={team.name}
                className="w-14 h-14 rounded-full object-cover"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-surface-2 flex items-center justify-center">
                <Shield size={24} className="text-muted" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold">{team.name}</h2>
              <p className="text-sm text-muted">Rating: {team.rating.toFixed(1)}</p>
            </div>
          </div>
          <div className="mb-6">
            <GeneratePlayerCredentials
              scope="team"
              teamId={teamId}
              teamName={team.name}
              playerCount={teamPlayerCount}
            />
          </div>
        </>
      )}

      <div className="space-y-6">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">Competitions</h2>
            <button
              onClick={() => router.push(`/org/${currentOrg?.slug}/competitions`)}
              className="btn-ghost text-sm"
            >
              View all <ArrowRight size={14} />
            </button>
          </div>
          {competitions.length === 0 ? (
            <div className="text-center py-6">
              <Trophy size={32} className="mx-auto text-muted/40 mb-2" />
              <p className="text-sm text-muted mb-3">No competitions yet</p>
              <button
                onClick={() => router.push(`/org/${currentOrg?.slug}/competitions/new`)}
                className="btn-primary text-sm"
              >
                <Plus size={14} /> Create Competition
              </button>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {competitions.slice(0, 6).map((comp) => (
                <button
                  key={comp.id}
                  onClick={() => router.push(`/org/${currentOrg?.slug}/competitions/${comp.id}`)}
                  className="flex items-center gap-3 p-3 rounded-lg border border-line hover:border-brand hover:bg-brand/5 transition-colors text-left"
                >
                  {comp.type === "league" ? <Trophy size={18} className="text-brand" /> :
                   comp.type === "cup" ? <Swords size={18} className="text-brand" /> :
                   <Users size={18} className="text-brand" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{comp.name}</p>
                    <p className="text-xs text-muted capitalize">{comp.status}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <MetricCards />
        {isAdmin && <LeagueStats />}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <UpcomingMatches />
          <TopFiveStandings />
        </div>
      </div>
    </div>
  );
}

function refreshTeamData() {
  const store = useAppStore.getState();
  return fetch("/api/team/data")
    .then((r) => r.json())
    .then((data) => {
      store.setTeams(data.teams || []);
      store.setPlayers(data.players || []);
      store.setFixtures(data.fixtures || []);
      store.setTeamDataLoaded(true);
    })
    .catch(() => {
      store.setTeamDataLoaded(true);
    });
}
