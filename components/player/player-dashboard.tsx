"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { usePlayerData } from "@/lib/hooks/use-player-data";
import { PlayerHero } from "./player-hero";
import { PlayerStatsSummary } from "./player-stats-summary";
import { PlayerFormGuide } from "./player-form-guide";
import { PlayerPerformanceChart } from "./player-performance-chart";
import { PlayerMatchHistory } from "./player-match-history";
import { PlayerBadges } from "./player-badges";
import { PlayerLeaderboards } from "./player-leaderboards";
import { Loader2, AlertCircle } from "lucide-react";

interface UpcomingMatch {
  id: number;
  round: number;
  homeId: number;
  awayId: number;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  date: string;
  time: string;
  venue: string;
}

function getUpcoming(teamFixtures: UpcomingMatch[], teamId: number) {
  return teamFixtures
    .filter((m) => m.status === "scheduled")
    .slice(0, 3);
}

function getTeamName(id: number, teamId: number, teamName: string, allFixtures: UpcomingMatch[]): string {
  const m = allFixtures.find((f) => f.homeId === id || f.awayId === id);
  return id === teamId ? teamName : `Team ${id}`;
}

export function PlayerDashboard() {
  const userProfile = useAppStore((s) => s.userProfile);
  const playerId = userProfile?.playerId ?? null;
  const { data, loading, error, refresh } = usePlayerData();

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <AlertCircle size={32} className="mx-auto mb-3 text-danger" />
        <p className="text-sm text-danger">{error}</p>
        <button onClick={refresh} className="btn-primary text-sm mt-4">Retry</button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card p-8 text-center text-muted">
        <p className="text-sm">No player data available.</p>
      </div>
    );
  }

  const { player, team, teamFixtures, allFixtures, allPlayers } = data;
  const upcoming = getUpcoming(teamFixtures, player.teamId);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">Player Dashboard</p>
        <h1 className="text-2xl font-bold">{player.name}</h1>
      </div>

      <PlayerHero player={player} team={team} />

      <PlayerStatsSummary player={player} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PlayerFormGuide
          teamFixtures={teamFixtures}
          teamId={player.teamId}
          matchRatings={player.matchRatings}
        />

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
            Upcoming Matches
          </h3>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted text-center py-4">No upcoming matches scheduled.</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-2">
                  <div className="text-sm">
                    <span className="font-medium">
                      {getTeamName(m.homeId, player.teamId, team?.name || "", allFixtures)}
                    </span>
                    <span className="text-muted mx-1.5">vs</span>
                    <span className="font-medium">
                      {getTeamName(m.awayId, player.teamId, team?.name || "", allFixtures)}
                    </span>
                  </div>
                  <div className="text-xs text-muted text-right">
                    <div>{m.date}{m.time ? ` ${m.time}` : ""}</div>
                    {m.venue && <div className="truncate max-w-[120px]">{m.venue}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <PlayerPerformanceChart
        teamFixtures={teamFixtures}
        matchRatings={player.matchRatings}
      />

      <PlayerBadges
        goals={player.goals}
        assists={player.assists}
        motm={player.motm}
        cleanSheets={player.cleanSheets}
        saves={player.saves}
      />

      <PlayerLeaderboards
        allPlayers={allPlayers}
        currentPlayerId={player.id}
      />

      <PlayerMatchHistory
        teamFixtures={teamFixtures}
        playerId={player.id}
        playerName={player.name}
        teamName={team?.name || "Unknown"}
        teamId={player.teamId}
        matchRatings={player.matchRatings}
      />
    </div>
  );
}
