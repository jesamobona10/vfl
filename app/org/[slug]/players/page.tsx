"use client";

import { useAppStore } from "@/lib/store";
import { PlayerCard } from "@/components/players/player-card";
import { Users } from "lucide-react";

export default function OrgPlayersPage() {
  const players = useAppStore((s) => s.players);
  const teams = useAppStore((s) => s.teams);
  const teamName = useAppStore((s) => s.teamName);

  const grouped = teams
    .map((team) => ({
      team,
      players: players.filter((p) => p.teamId === team.id),
    }))
    .filter((g) => g.players.length > 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Players</h1>
        <p className="text-sm text-muted">
          {players.length} player{players.length !== 1 ? "s" : ""} across {grouped.length} team{grouped.length !== 1 ? "s" : ""}
        </p>
      </div>

      {grouped.length === 0 ? (
        <div className="text-center py-16">
          <Users size={48} className="mx-auto text-muted/30 mb-4" />
          <p className="text-muted">No players yet.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ team, players: teamPlayers }) => (
            <div key={team.id}>
              <div className="flex items-center gap-3 mb-3">
                {team.logo_url ? (
                  <img src={team.logo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-xs text-muted">
                    {team.name.charAt(0)}
                  </div>
                )}
                <h2 className="text-lg font-semibold">{team.name}</h2>
                <span className="text-xs text-muted">{teamPlayers.length} player{teamPlayers.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {teamPlayers.map((p) => (
                  <PlayerCard
                    key={p.id}
                    player={p}
                    teamName={teamName(p.teamId)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
