"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { useResolvedTeams } from "@/lib/hooks/use-resolved-teams";
import { Plus, Trash2 } from "lucide-react";
import { GeneratePlayerCredentials } from "@/components/players/generate-player-credentials";
import { useConfirm } from "@/components/shared/confirm-dialog";
import type { Player } from "@/lib/types";

/**
 * Inline admin component for managing players (add, delete, filter by team).
 * Extracted from admin-panel.tsx for single-responsibility.
 */
export function AdminPlayerManager() {
  const { confirm, dialog: confirmDialog } = useConfirm();
  const isAdmin = useAppStore((s) => s.isAdmin);
  const players = useAppStore((s) => s.players);
  const currentSeasonId = useAppStore((s) => s.currentSeasonId);
  const teams = useResolvedTeams(currentSeasonId);
  const addPlayer = useAppStore((s) => s.addPlayer);
  const deletePlayer = useAppStore((s) => s.deletePlayer);
  const deleteTeamPlayers = useAppStore((s) => s.deleteTeamPlayers);
  const [filterTeam, setFilterTeam] = useState("");
  const [newName, setNewName] = useState("");
  const [newPosition, setNewPosition] = useState<Player["position"]>("MID");
  const [newNumber, setNewNumber] = useState("");
  const [newTeam, setNewTeam] = useState("");

  const filtered = filterTeam ? players.filter((p) => p.teamId === Number(filterTeam)) : players;

  const handleAdd = () => {
    if (!newName.trim() || !newTeam) return;
    const teamPlayers = players.filter((p) => p.teamId === Number(newTeam));
    const maxId = players.reduce((m, p) => Math.max(m, p.id), 0);
    addPlayer({
      id: maxId + 1,
      teamId: Number(newTeam),
      name: newName.trim(),
      position: newPosition,
      number: parseInt(newNumber) || teamPlayers.length + 1,
      goals: 0,
      assists: 0,
      ownGoals: 0,
      yellowCards: 0,
      redCards: 0,
      saves: 0,
      penaltySaves: 0,
      cleanSheets: 0,
      motm: 0,
      tackles: 0,
      interceptions: 0,
      blocks: 0,
      aerialDuelsWon: 0,
      errorsLeadingToGoal: 0,
      penaltiesConceded: 0,
      goalsConceded: 0,
      matchWins: 0,
      bonus5Saves: 0,
      captain: false,
      rating: 6.0,
      matchRatings: {},
    });
    setNewName("");
    setNewNumber("");
  };

  const handleDelete = async (id: number) => {
    const p = players.find((pl) => pl.id === id);
    if (!p) return;
    if (!(await confirm({ title: `Delete player ${p.name}?`, confirmLabel: "Delete" }))) return;
    deletePlayer(id);
  };

  const handleDeleteAllFromTeam = async () => {
    if (!filterTeam) return;
    const team = teams.find((t) => t.id === Number(filterTeam));
    if (!team) return;
    if (
      !(await confirm({
        title: `Delete all players from ${team.name}?`,
        description: "Every player on this team will be removed. This cannot be undone.",
      }))
    )
      return;
    deleteTeamPlayers(Number(filterTeam));
  };

  const filterTeamName = filterTeam
    ? teams.find((t) => t.id === Number(filterTeam))?.name
    : undefined;

  return (
    <div className="space-y-4">
      {confirmDialog}
      <h3 className="text-lg font-bold">Players</h3>

      {isAdmin && (
        <GeneratePlayerCredentials
          scope="admin"
          teamId={filterTeam ? Number(filterTeam) : undefined}
          teamName={filterTeamName}
          playerCount={filtered.length}
        />
      )}

      <div className="card p-4 space-y-3">
        <h4 className="text-sm font-semibold text-muted uppercase tracking-wider">Add Player</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <select
            value={newTeam}
            onChange={(e) => setNewTeam(e.target.value)}
            className="input text-sm py-1.5"
          >
            <option value="">Team...</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="input text-sm py-1.5"
            placeholder="Player name"
          />
          <select
            value={newPosition}
            onChange={(e) => setNewPosition(e.target.value as Player["position"])}
            className="input text-sm py-1.5"
          >
            <option value="GK">GK</option>
            <option value="DEF">DEF</option>
            <option value="MID">MID</option>
            <option value="ATT">ATT</option>
          </select>
          <input
            type="number"
            min={1}
            max={99}
            value={newNumber}
            onChange={(e) => setNewNumber(e.target.value)}
            className="input text-sm py-1.5"
            placeholder="Number"
          />
          <button
            onClick={handleAdd}
            className="btn-primary text-sm py-1.5"
            disabled={!newName.trim() || !newTeam}
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={filterTeam}
          onChange={(e) => setFilterTeam(e.target.value)}
          className="input w-auto text-sm py-1.5"
        >
          <option value="">All Teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {filterTeam && (
          <button onClick={handleDeleteAllFromTeam} className="btn-ghost text-xs text-danger">
            <Trash2 size={14} /> Delete All from Team
          </button>
        )}
        <span className="text-xs text-muted ml-auto">{filtered.length} player(s)</span>
      </div>

      <div className="space-y-1">
        {filtered.map((p) => {
          const team = teams.find((t) => t.id === p.teamId);
          return (
            <div key={p.id} className="card px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-xs font-bold text-white shrink-0">
                {p.name.charAt(0).toUpperCase()}
              </div>
              <span className="w-8 text-muted text-xs shrink-0">#{p.number}</span>
              <span className="font-medium flex-1 min-w-[100px] truncate">{p.name}</span>
              <span className="text-xs text-muted w-10">{p.position}</span>
              <span className="text-xs text-muted max-w-[120px] truncate">{team?.name || "?"}</span>
              <span className="text-xs text-muted whitespace-nowrap">
                G:{p.goals} A:{p.assists}
              </span>
              <button
                onClick={() => handleDelete(p.id)}
                className="btn-icon text-danger"
                title="Delete player"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-muted text-center py-4">No players found.</p>
        )}
      </div>
    </div>
  );
}
