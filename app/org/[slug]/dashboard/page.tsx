"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { MetricCards } from "@/components/dashboard/metric-cards";
import { LeagueStats } from "@/components/dashboard/league-stats";
import { UpcomingMatches } from "@/components/dashboard/upcoming-matches";
import { TopFiveStandings } from "@/components/dashboard/top-five-standings";
import { PlayerDashboard } from "@/components/player/player-dashboard";
import { Shield, RefreshCw, Loader2 } from "lucide-react";
import { GeneratePlayerCredentials } from "@/components/players/generate-player-credentials";
import { useParams } from "next/navigation";

export default function OrgDashboardPage() {
  const params = useParams();
  const currentOrg = useAppStore((s) => s.currentOrg);
  const teams = useAppStore((s) => s.teams);
  const players = useAppStore((s) => s.players);
  const isAdmin = useAppStore((s) => s.isAdmin);
  const isPlayer = useAppStore((s) => s.userProfile?.role === "player");
  const currentTeamAccount = useAppStore((s) => s.currentTeamAccount);
  const teamDataLoaded = useAppStore((s) => s.teamDataLoaded);
  const setTeamDataLoaded = useAppStore((s) => s.setTeamDataLoaded);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (currentTeamAccount && !teamDataLoaded && !fetching) {
      setFetching(true);
      refreshTeamData().finally(() => setFetching(false));
    }
  }, [currentTeamAccount, teamDataLoaded, fetching]);

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
