"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { TeamCard } from "./team-card";
import { RotateCcw, AlertCircle, Plus, Trash2 } from "lucide-react";

export function TeamForm() {
  const [newTeamName, setNewTeamName] = useState("");
  const teams = useAppStore((s) => s.teams);
  const isTeamAccount = useAppStore((s) => s.isTeamAccount);
  const getManagedTeamId = useAppStore((s) => s.getManagedTeamId);
  const resetTeams = useAppStore((s) => s.resetTeams);
  const setFixtures = useAppStore((s) => s.setFixtures);
  const deleteAllPlayers = useAppStore((s) => s.deleteAllPlayers);
  const addTeam = useAppStore((s) => s.addTeam);
  const deleteTeam = useAppStore((s) => s.deleteTeam);
  const deleteTeamPlayers = useAppStore((s) => s.deleteTeamPlayers);

  const isTeam = isTeamAccount();
  const managedId = getManagedTeamId();

  const visibleTeams = isTeam
    ? teams.filter((t) => t.id === managedId)
    : teams;

  const validationMsg = (() => {
    if (isTeam) {
      const team = teams.find((t) => t.id === managedId);
      return team && !team.name.trim()
        ? "Your team needs a name."
        : "";
    }
    const names = teams.map((t) => t.name.trim().toLowerCase());
    const hasEmpty = names.some((n) => !n);
    const hasDuplicate = new Set(names).size !== names.length;
    if (hasEmpty) return `All ${teams.length} teams need names.`;
    if (hasDuplicate) return "Team names must be unique.";
    return "";
  })();

  const handleAdd = () => {
    const name = newTeamName.trim();
    if (!name) return;
    const maxId = teams.reduce((max, t) => Math.max(max, t.id), 0);
    addTeam({ id: maxId + 1, name, rating: 6.0 });
    setNewTeamName("");
  };

  const handleDelete = (id: number) => {
    const name = teams.find((t) => t.id === id)?.name || "this team";
    if (!confirm(`Delete ${name} and all its players? This cannot be undone.`)) return;
    deleteTeam(id);
    deleteTeamPlayers(id);
  };

  const handleResetNames = () => {
    if (
      confirm(
        "Reset all team names to defaults? This will also clear all fixtures and players."
      )
    ) {
      resetTeams();
      setFixtures([]);
      deleteAllPlayers();
    }
  };

  const handleResetAll = () => {
    if (!confirm("Reset ALL data (teams, fixtures, players)? This cannot be undone.")) return;
    resetTeams();
    setFixtures([]);
    deleteAllPlayers();
  };

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Team Management</h1>
          <p className="text-sm text-muted">Exactly 11 Teams Required</p>
        </div>

        {!isTeam && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex gap-2">
              <input
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                className="input"
                placeholder="New team name..."
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <button
                onClick={handleAdd}
                className="btn-primary"
                disabled={!newTeamName.trim()}
              >
                <Plus size={16} />
                Add Team
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={handleResetNames} className="btn-ghost">
                <RotateCcw size={16} />
                Reset Names
              </button>
              <button onClick={handleResetAll} className="btn-ghost text-danger">
                <Trash2 size={16} />
                Reset All Data
              </button>
            </div>
          </div>
        )}
      </div>

      {validationMsg && (
        <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-4 py-3 mb-6">
          <AlertCircle size={16} />
          {validationMsg}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {visibleTeams.map((team, index) => (
          <TeamCard
            key={team.id}
            team={team}
            index={teams.indexOf(team)}
            isManaged={isTeam && team.id === managedId}
            showAdmin={!isTeam}
            onDelete={!isTeam ? handleDelete : undefined}
          />
        ))}
      </div>
    </div>
  );
}
