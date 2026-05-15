"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import type { Player } from "@/lib/types";
import { X } from "lucide-react";

interface PlayerModalProps {
  player: Player | null;
  onClose: () => void;
}

export function PlayerModal({ player, onClose }: PlayerModalProps) {
  const teams = useAppStore((s) => s.teams);
  const addPlayer = useAppStore((s) => s.addPlayer);
  const updatePlayer = useAppStore((s) => s.updatePlayer);
  const isTeamAccount = useAppStore((s) => s.isTeamAccount);
  const getManagedTeamId = useAppStore((s) => s.getManagedTeamId);

  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [position, setPosition] = useState("");
  const [number, setNumber] = useState("");
  const [captain, setCaptain] = useState(false);
  const [error, setError] = useState("");

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Player name is required.");
      return;
    }
    const tid = managedId || Number(teamId);
    if (!tid) {
      setError("Team is required.");
      return;
    }
    if (!position) {
      setError("Position is required.");
      return;
    }
    const num = Number(number);
    if (!Number.isFinite(num) || num < 1 || num > 99) {
      setError("Jersey number must be between 1 and 99.");
      return;
    }

    if (isEdit && player) {
      updatePlayer(player.id, {
        name: name.trim(),
        teamId: tid,
        position: position as Player["position"],
        number: num,
        captain,
      });
    } else {
      addPlayer({
        id: Date.now() + Math.floor(Math.random() * 1000),
        teamId: tid,
        name: name.trim(),
        position: position as Player["position"],
        number: num,
        captain,
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
        rating: 6.0,
        matchRatings: {},
      });
    }
    onClose();
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
              disabled={!!managedId || isEdit}
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

          <button type="submit" className="btn-primary w-full">
            {isEdit ? "Update Player" : "Save Player"}
          </button>
        </form>
      </div>
    </div>
  );
}
