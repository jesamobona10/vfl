"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import type { Player } from "@/lib/types";
import { X } from "lucide-react";

interface PlayerModalProps {
  player: Player | null;
  onClose: () => void;
}

function mapDbPlayer(player: any): Player {
  return {
    id: player.id,
    teamId: player.team_id,
    name: player.name,
    position: player.position as Player["position"],
    number: player.jersey_number || 0,
    goals: player.goals ?? 0,
    assists: player.assists ?? 0,
    ownGoals: 0,
    yellowCards: player.yellow_cards ?? 0,
    redCards: player.red_cards ?? 0,
    saves: player.saves ?? 0,
    penaltySaves: 0,
    cleanSheets: player.clean_sheets ?? 0,
    motm: 0,
    tackles: player.tackles ?? 0,
    interceptions: player.interceptions ?? 0,
    blocks: player.blocks ?? 0,
    aerialDuelsWon: player.aerial_duels_won ?? 0,
    errorsLeadingToGoal: player.errors_leading_to_goal ?? 0,
    penaltiesConceded: player.penalties_conceded ?? 0,
    goalsConceded: player.goals_conceded ?? 0,
    matchWins: player.match_wins ?? 0,
    bonus5Saves: player.bonus_5_saves ?? 0,
    captain: player.is_captain ?? false,
    rating: player.rating ?? 6.0,
    matchRatings: player.match_ratings ?? {},
  };
}

export function PlayerModal({ player, onClose }: PlayerModalProps) {
  const teams = useAppStore((s) => s.teams);
  const addPlayer = useAppStore((s) => s.addPlayer);
  const updatePlayer = useAppStore((s) => s.updatePlayer);
  const isTeamAccount = useAppStore((s) => s.isTeamAccount)();
  const getManagedTeamId = useAppStore((s) => s.getManagedTeamId);

  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [position, setPosition] = useState("");
  const [number, setNumber] = useState("");
  const [captain, setCaptain] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const isEdit = player !== null;
  const managedId = getManagedTeamId();

  useEffect(() => {
    if (player) {
      setName(player.name);
      setTeamId(String(player.teamId));
      setPosition(player.position);
      setNumber(String(player.number));
      setCaptain(player.captain);
    } else {
      setName("");
      setTeamId(managedId ? String(managedId) : "");
      setPosition("");
      setNumber("");
      setCaptain(false);
    }
  }, [player, managedId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    if (!name.trim()) {
      setError("Player name is required.");
      setSaving(false);
      return;
    }
    const tid = managedId || Number(teamId);
    // If editing, and this is a team account, ensure they can only edit players from their team
    if (isEdit && isTeamAccount && player && managedId && player.teamId !== managedId) {
      setError("Not authorized to edit this player.");
      setSaving(false);
      return;
    }
    if (!tid) {
      setError("Team is required.");
      setSaving(false);
      return;
    }
    if (!position) {
      setError("Position is required.");
      setSaving(false);
      return;
    }
    const num = Number(number);
    if (!Number.isFinite(num) || num < 1 || num > 99) {
      setError("Jersey number must be between 1 and 99.");
      setSaving(false);
      return;
    }

    try {
      const payload = {
        team_id: tid,
        name: name.trim(),
        position,
        jersey_number: num,
        is_captain: captain,
      };

      if (isEdit && player) {
        const res = await fetch(`/api/players/${player.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = await res.json();
        if (!res.ok) {
          setError(body.error || "Failed to update player.");
          return;
        }
        const updatedPlayer = mapDbPlayer(body.player);
        updatePlayer(player.id, updatedPlayer);
      } else {
        const res = await fetch(`/api/players`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = await res.json();
        if (!res.ok) {
          setError(body.error || "Failed to create player.");
          return;
        }
        addPlayer(mapDbPlayer(body.player));
      }
      onClose();
    } catch {
      setError("Unable to save player. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-md relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 btn-icon"
        >
          <X size={18} />
        </button>

        <h2 className="text-lg font-bold mb-4">
          {isEdit ? "Edit Player" : "Add Player"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Player Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="Player name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Team
            </label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="input"
              disabled={!!managedId && !isEdit}
              required
            >
              <option value="">Select a team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Position
            </label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="input"
              required
            >
              <option value="">Select position</option>
              <option value="GK">Goalkeeper</option>
              <option value="DEF">Defender</option>
              <option value="MID">Midfielder</option>
              <option value="ATT">Attacker</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Jersey Number
            </label>
            <input
              type="number"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className="input"
              placeholder="1-99"
              min={1}
              max={99}
              required
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={captain}
              onChange={(e) => setCaptain(e.target.checked)}
              className="rounded border-line"
            />
            <span className="text-sm font-medium">
              Team Captain
            </span>
          </label>

          {error && (
            <p className="text-sm text-danger">{error}</p>
          )}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={saving}
          >
            {saving
              ? isEdit
                ? "Updating..."
                : "Saving..."
              : isEdit
              ? "Update Player"
              : "Save Player"}
          </button>
        </form>
      </div>
    </div>
  );
}
