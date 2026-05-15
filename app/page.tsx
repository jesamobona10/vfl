"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { refreshTeamData } from "@/lib/hooks/use-team-data";
import { MetricCards } from "@/components/dashboard/metric-cards";
import { LeagueStats } from "@/components/dashboard/league-stats";
import { UpcomingMatches } from "@/components/dashboard/upcoming-matches";
import { TopFiveStandings } from "@/components/dashboard/top-five-standings";
import { Shield, RefreshCw, Loader2 } from "lucide-react";

export default function DashboardPage() {
  const teams = useAppStore((s) => s.teams);
  const generateFixtures = useAppStore((s) => s.generateFixtures);
  const isAdmin = useAppStore((s) => s.isAdmin);
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

  if (currentTeamAccount && !teamDataLoaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-muted">
            {currentTeamAccount ? "Team Dashboard" : "Season Control"}
          </p>
          <h1 className="text-2xl font-bold">
            {currentTeamAccount
              ? `${currentTeamAccount.name}`
              : "Dashboard"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
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
          {isAdmin && (
            <button
              onClick={() => generateFixtures(teams)}
              disabled={teams.length < 2}
              className="btn-primary"
            >
              <RefreshCw size={16} />
              Generate Fixtures
            </button>
          )}
        </div>
      </div>

      {currentTeamAccount && team && (
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
      )}

      <div className="space-y-6">
        <MetricCards />
        <LeagueStats />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <UpcomingMatches />
          <TopFiveStandings />
        </div>
      </div>
    </div>
  );
}
