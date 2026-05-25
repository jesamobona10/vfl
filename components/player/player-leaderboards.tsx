"use client";

import { Trophy, Medal, Star } from "lucide-react";

interface LeaderboardEntry {
  id: number;
  name: string;
  teamName: string;
  teamLogo: string | null;
  goals: number;
  assists: number;
  motm: number;
  rating: number;
}

interface PlayerLeaderboardsProps {
  allPlayers: LeaderboardEntry[];
  currentPlayerId: number;
}

export function PlayerLeaderboards({ allPlayers, currentPlayerId }: PlayerLeaderboardsProps) {
  const topScorers = [...allPlayers].sort((a, b) => b.goals - a.goals || b.rating - a.rating).slice(0, 5);
  const topAssisters = [...allPlayers].sort((a, b) => b.assists - a.assists || b.goals - a.goals).slice(0, 5);
  const topRated = [...allPlayers].sort((a, b) => b.rating - a.rating || b.goals - a.goals).slice(0, 5);

  const currentInScorers = allPlayers.findIndex((p) => p.id === currentPlayerId);
  const currentInAssisters = [...allPlayers].sort((a, b) => b.assists - a.assists).findIndex((p) => p.id === currentPlayerId);
  const currentInRated = [...allPlayers].sort((a, b) => b.rating - a.rating).findIndex((p) => p.id === currentPlayerId);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <LeaderboardTable
        title="Top Scorers"
        icon={<Trophy size={14} className="text-accent" />}
        entries={topScorers}
        currentPlayerId={currentPlayerId}
        valueKey="goals"
        valueLabel="G"
        playerRank={currentInScorers}
      />
      <LeaderboardTable
        title="Most Assists"
        icon={<Medal size={14} className="text-accent" />}
        entries={topAssisters}
        currentPlayerId={currentPlayerId}
        valueKey="assists"
        valueLabel="A"
        playerRank={currentInAssisters}
      />
      <LeaderboardTable
        title="Highest Rating"
        icon={<Star size={14} className="text-accent" />}
        entries={topRated}
        currentPlayerId={currentPlayerId}
        valueKey="rating"
        valueLabel="Rt"
        playerRank={currentInRated}
      />
    </div>
  );
}

function LeaderboardTable({
  title,
  icon,
  entries,
  currentPlayerId,
  valueKey,
  valueLabel,
  playerRank,
}: {
  title: string;
  icon: React.ReactNode;
  entries: LeaderboardEntry[];
  currentPlayerId: number;
  valueKey: keyof LeaderboardEntry;
  valueLabel: string;
  playerRank: number;
}) {
  const rankIcons = ["🥇", "🥈", "🥉"];

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">{title}</h4>
      </div>

      <div className="space-y-2">
        {entries.map((p, i) => {
          const isYou = p.id === currentPlayerId;
          return (
            <div
              key={p.id}
              className={`flex items-center gap-2 text-sm py-1.5 px-2 rounded-lg ${
                isYou ? "bg-brand/10 ring-1 ring-brand/20" : ""
              }`}
            >
              <span className="w-5 text-center text-xs">
                {i < 3 ? rankIcons[i] : `#${i + 1}`}
              </span>
              <div className="w-6 h-6 rounded-full bg-surface-2 overflow-hidden shrink-0">
                {p.teamLogo ? (
                  <img src={p.teamLogo} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[8px] text-muted">
                    {p.teamName[0]}
                  </div>
                )}
              </div>
              <span className={`flex-1 truncate ${isYou ? "font-semibold text-brand" : ""}`}>
                {p.name}{isYou ? " (You)" : ""}
              </span>
              <span className="text-xs text-muted font-mono">
                {String(p[valueKey])}{valueLabel === "Rt" ? "" : ""}
              </span>
            </div>
          );
        })}
      </div>

      {playerRank >= 5 && (
        <div className="text-xs text-muted text-center mt-2 pt-2 border-t border-line">
          You are #{playerRank + 1} overall
        </div>
      )}
    </div>
  );
}
