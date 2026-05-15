"use client";

import { useAppStore } from "@/lib/store";
import { TeamCard } from "./team-card";
import { RotateCcw, AlertCircle } from "lucide-react";

export function TeamForm() {
  const teams = useAppStore((s) => s.teams);
  const isTeamAccount = useAppStore((s) => s.isTeamAccount);
  const getManagedTeamId = useAppStore((s) => s.getManagedTeamId);
  const resetTeams = useAppStore((s) => s.resetTeams);
  const setFixtures = useAppStore((s) => s.setFixtures);
  const deleteAllPlayers = useAppStore((s) => s.deleteAllPlayers);

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
    if (hasEmpty) return "All 11 teams need names.";
    if (hasDuplicate) return "Team names must be unique.";
    return "";
  })();

  const handleReset = () => {
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Team Management</h1>
          <p className="text-sm text-muted">
            Exactly 11 Teams Required
          </p>
        </div>
        {!isTeam && (
          <button onClick={handleReset} className="btn-ghost">
            <RotateCcw size={16} />
            Reset Names
          </button>
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
          />
        ))}
      </div>
    </div>
  );
}
