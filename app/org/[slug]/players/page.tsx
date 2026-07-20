"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { PlayerCard } from "@/components/players/player-card";
import { PlayerModal } from "@/components/players/player-modal";
import { PlayerProfile } from "@/components/players/player-profile";
import { Users, Plus } from "lucide-react";
import type { Player } from "@/lib/types";

export default function OrgPlayersPage() {
  const players = useAppStore((s) => s.players);
  const teams = useAppStore((s) => s.teams);
  const teamName = useAppStore((s) => s.teamName);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [profilePlayer, setProfilePlayer] = useState<Player | null>(null);

  const grouped = teams
    .map((team) => ({
      team,
      players: players.filter((p) => p.teamId === team.id),
    }))
    .filter((g) => g.players.length > 0);

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Players</h1>
          <p className="text-sm text-muted">
            {players.length} player{players.length !== 1 ? "s" : ""} across {grouped.length} team{grouped.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={() => setAddModalOpen(true)} className="btn-primary">
          <Plus size={16} />
          Add Player
        </button>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {teamPlayers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setProfilePlayer(p)}
                    className="text-left w-full"
                  >
                    <PlayerCard
                      player={p}
                      teamName={teamName(p.teamId)}
                    />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {addModalOpen && (
        <PlayerModal
          player={null}
          onClose={() => setAddModalOpen(false)}
        />
      )}

      {profilePlayer && (
        <PlayerProfile
          player={profilePlayer}
          teamName={teamName(profilePlayer.teamId)}
          onClose={() => setProfilePlayer(null)}
        />
      )}
    </div>
  );
}
