"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useOrg } from "@/lib/hooks/use-org";
import { TeamCard } from "./team-card";
import { RotateCcw, AlertCircle, Plus, Trash2, Shield, Loader2 } from "lucide-react";
import type { Team } from "@/lib/types";

export function TeamForm() {
  const params = useParams();
  const slug = params.slug as string;
  const { data: currentOrg } = useOrg(slug);

  const [newTeamName, setNewTeamName] = useState("");
  const [adminError, setAdminError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const teams = useAppStore((s) => s.teams);
  const players = useAppStore((s) => s.players);
  const isTeamAccount = useAppStore((s) => s.isTeamAccount);
  const getManagedTeamId = useAppStore((s) => s.getManagedTeamId);
  const resetTeams = useAppStore((s) => s.resetTeams);
  const setTeams = useAppStore((s) => s.setTeams);
  const setFixtures = useAppStore((s) => s.setFixtures);
  const deleteAllPlayers = useAppStore((s) => s.deleteAllPlayers);
  const addTeam = useAppStore((s) => s.addTeam);
  const deleteTeam = useAppStore((s) => s.deleteTeam);
  const deleteTeamPlayers = useAppStore((s) => s.deleteTeamPlayers);

  const isTeam = isTeamAccount();
  const managedId = getManagedTeamId();

  useEffect(() => {
    if (!currentOrg?.id) return;
    setLoadingTeams(true);
    fetch(`/api/teams?org_id=${currentOrg.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.teams) setTeams(data.teams);
      })
      .catch(() => {})
      .finally(() => setLoadingTeams(false));
  }, [currentOrg?.id, setTeams]);

  const visibleTeams = isTeam
    ? teams.filter((t) => t.id === managedId)
    : teams;

  const totalPlayers = isTeam
    ? players.filter((p) => p.teamId === managedId).length
    : players.length;

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

  const handleAdd = async () => {
    const name = newTeamName.trim();
    if (!name) return;
    if (!currentOrg?.id) {
      setAdminError("Organization not loaded.");
      return;
    }
    setAdminError("");

    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, organization_id: currentOrg.id, rating: 6.0 }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setAdminError(payload.error || "Could not add team.");
        return;
      }

      const newTeam: Team = {
        id: payload.team.id,
        name: payload.team.name,
        rating: payload.team.rating ?? 6.0,
        logo_url: payload.team.logo_url || undefined,
      };
      addTeam(newTeam);
      setNewTeamName("");
      setShowAddForm(false);
    } catch (error) {
      setAdminError("Unable to add team. Please try again.");
      console.error("Add team error:", error);
    }
  };

  const handleDelete = async (id: number) => {
    const name = teams.find((t) => t.id === id)?.name || "this team";
    if (!confirm(`Delete ${name} and all its players? This cannot be undone.`)) return;
    setAdminError("");

    try {
      const res = await fetch(`/api/teams/${id}`, {
        method: "DELETE",
      });
      const payload = await res.json();
      if (!res.ok) {
        setAdminError(payload.error || "Could not delete team.");
        return;
      }
      deleteTeam(id);
      deleteTeamPlayers(id);
    } catch (error) {
      setAdminError("Unable to delete team. Please try again.");
      console.error("Delete team error:", error);
    }
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
          <p className="text-sm text-muted">
            {teams.length} team{teams.length !== 1 ? "s" : ""} &middot; {totalPlayers} player{totalPlayers !== 1 ? "s" : ""}
          </p>
        </div>

        {!isTeam && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="btn-primary"
            >
              <Plus size={16} />
              {showAddForm ? "Cancel" : "Add Team"}
            </button>
            <button onClick={handleResetNames} className="btn-ghost">
              <RotateCcw size={16} />
              Reset Names
            </button>
            <button onClick={handleResetAll} className="btn-ghost text-danger">
              <Trash2 size={16} />
              Reset All
            </button>
          </div>
        )}
      </div>

      {!isTeam && showAddForm && (
        <div className="card p-4 mb-6 border-l-4 border-l-brand">
          <div className="flex items-center gap-3">
            <Shield size={18} className="text-brand shrink-0" />
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              className="input flex-1"
              placeholder="Enter new team name..."
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              autoFocus
            />
            <button
              onClick={handleAdd}
              className="btn-primary text-sm"
              disabled={!newTeamName.trim()}
            >
              Add
            </button>
          </div>
        </div>
      )}

      {(validationMsg || adminError) && (
        <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-4 py-3 mb-6">
          <AlertCircle size={16} />
          {validationMsg || adminError}
        </div>
      )}

      {loadingTeams ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-muted" />
        </div>
      ) : visibleTeams.length === 0 ? (
        <div className="card p-12 text-center text-muted">
          <Shield size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">No teams yet</p>
          <p className="text-sm mt-1">Add your first team to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visibleTeams.map((team, index) => (
            <TeamCard
              key={team.id}
              team={team}
              index={index}
              isManaged={isTeam && team.id === managedId}
              showAdmin={!isTeam}
              onDelete={!isTeam ? handleDelete : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
