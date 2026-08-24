"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { useResolvedTeams } from "@/lib/hooks/use-resolved-teams";
import { Modal } from "@/components/ui/modal";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { ErrorBanner } from "@/components/shared/error-banner";
import type { Player } from "@/lib/types";

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
  const currentSeasonId = useAppStore((s) => s.currentSeasonId);
  const teams = useResolvedTeams(currentSeasonId);
  const addPlayer = useAppStore((s) => s.addPlayer);
  const updatePlayer = useAppStore((s) => s.updatePlayer);
  const isTeamAccount = useAppStore((s) => s.isTeamAccount)();
  const getManagedTeamId = useAppStore((s) => s.getManagedTeamId);
  const { confirm } = useConfirm();

  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [position, setPosition] = useState("");
  const [number, setNumber] = useState("");
  const [captain, setCaptain] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const isEdit = player !== null;
  const managedId = getManagedTeamId();
  const canChangeTeam = !isTeamAccount;

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
    setError("");
  }, [player, managedId]);

  async function persistPlayer(payload: Record<string, unknown>) {
    if (isEdit && player) {
      const res = await fetch(`/api/players/${player.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Failed to update player.");
        return false;
      }
      updatePlayer(player.id, mapDbPlayer(body.player));
    } else {
      const res = await fetch(`/api/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Failed to create player.");
        return false;
      }
      addPlayer(mapDbPlayer(body.player));
    }
    return true;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Player name is required.");
      return;
    }
    const tid = isTeamAccount ? managedId : Number(teamId);
    if (isEdit && isTeamAccount && player && managedId && player.teamId !== managedId) {
      setError("Not authorized to edit this player.");
      return;
    }
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

    const payload = {
      team_id: tid,
      name: name.trim(),
      position,
      jersey_number: num,
      is_captain: captain,
    };

    // Changing a player's team creates a transfer record — confirm first.
    if (canChangeTeam && isEdit && player && String(player.teamId) !== String(payload.team_id)) {
      const fromName = teams.find((t) => String(t.id) === String(player.teamId))?.name || "Unknown";
      const toName = teams.find((t) => String(t.id) === String(teamId))?.name || "Unknown";
      if (
        !(await confirm({
          title: "Transfer this player?",
          description: `${player.name} will move from ${fromName} to ${toName}. This creates a transfer record.`,
          confirmLabel: "Transfer",
        }))
      )
        return;
    }

    setSaving(true);
    try {
      if (await persistPlayer(payload)) onClose();
    } catch {
      setError("Unable to save player. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? "Edit Player" : "Add Player"} className="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="player-name" className="block text-sm font-medium mb-1">
            Player Name
          </label>
          <input
            id="player-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="Player name"
            required
          />
        </div>

        <div>
          <label htmlFor="player-team" className="block text-sm font-medium mb-1">
            Team
          </label>
          <select
            id="player-team"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="input"
            disabled={!canChangeTeam}
            required
          >
            <option value="">Select a team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {canChangeTeam ? (
            <p className="text-xs text-muted mt-2">
              Changing a player&apos;s team creates a transfer record and requires confirmation.
            </p>
          ) : (
            <p className="text-xs text-muted mt-2">Team is locked for team accounts.</p>
          )}
        </div>

        <div>
          <label htmlFor="player-position" className="block text-sm font-medium mb-1">
            Position
          </label>
          <select
            id="player-position"
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
          <label htmlFor="player-number" className="block text-sm font-medium mb-1">
            Jersey Number
          </label>
          <input
            id="player-number"
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

        <label htmlFor="player-captain" className="flex items-center gap-2 cursor-pointer">
          <input
            id="player-captain"
            type="checkbox"
            checked={captain}
            onChange={(e) => setCaptain(e.target.checked)}
            className="rounded border-line"
          />
          <span className="text-sm font-medium">Team Captain</span>
        </label>

        <ErrorBanner message={error} />

        <button type="submit" className="btn-primary w-full" disabled={saving}>
          {saving
            ? isEdit
              ? "Updating..."
              : "Saving..."
            : isEdit
              ? "Update Player"
              : "Save Player"}
        </button>
      </form>
    </Modal>
  );
}
