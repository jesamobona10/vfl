"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Match, MatchEvent, Player } from "@/lib/types";

const EVENT_TYPES: { value: string; label: string }[] = [
  { value: "goal", label: "Goal" },
  { value: "assist", label: "Assist" },
  { value: "own-goal", label: "Own Goal" },
  { value: "yellow", label: "Yellow Card" },
  { value: "red", label: "Red Card" },
  { value: "save", label: "Save" },
  { value: "penalty-save", label: "Penalty Save" },
  { value: "clean-sheet", label: "Clean Sheet" },
  { value: "motm", label: "Man of the Match" },
  { value: "error", label: "Error Leading to Goal" },
  { value: "penalty-conceded", label: "Penalty Conceded" },
  { value: "tackle", label: "Successful Tackle" },
  { value: "interception", label: "Interception" },
  { value: "block", label: "Block" },
  { value: "aerial", label: "Aerial Duel Won" },
  { value: "goal-conceded", label: "Goal Conceded" },
  { value: "match-win", label: "Match Win" },
  { value: "bonus-5-saves", label: "5+ Saves Bonus" },
];

const EVENT_ABBR: Record<string, string> = {
  goal: "G",
  assist: "A",
  "own-goal": "OG",
  yellow: "Y",
  red: "R",
  save: "SV",
  "penalty-save": "PS",
  "clean-sheet": "CS",
  motm: "MOTM",
  error: "ERR",
  "penalty-conceded": "PC",
  tackle: "T",
  interception: "INT",
  block: "BLK",
  aerial: "AD",
  "goal-conceded": "GC",
  "match-win": "W",
  "bonus-5-saves": "5+S",
};

const STAT_FIELD: Record<string, keyof Player> = {
  goal: "goals",
  assist: "assists",
  "own-goal": "ownGoals",
  yellow: "yellowCards",
  red: "redCards",
  save: "saves",
  "penalty-save": "penaltySaves",
  "clean-sheet": "cleanSheets",
  motm: "motm",
  error: "errorsLeadingToGoal",
  "penalty-conceded": "penaltiesConceded",
  tackle: "tackles",
  interception: "interceptions",
  block: "blocks",
  aerial: "aerialDuelsWon",
  "goal-conceded": "goalsConceded",
  "match-win": "matchWins",
  "bonus-5-saves": "bonus5Saves",
};

interface EventLogProps {
  match: Match;
  homePlayers: Player[];
  awayPlayers: Player[];
}

export function EventLog({
  match,
  homePlayers,
  awayPlayers,
}: EventLogProps) {
  const [playerId, setPlayerId] = useState("");
  const [eventType, setEventType] = useState("goal");

  const updateMatch = useAppStore((s) => s.updateMatch);
  const updatePlayer = useAppStore((s) => s.updatePlayer);
  const getTeam = useAppStore((s) => s.getTeam);

  const events = match.events || [];
  const homeTeam = getTeam(match.homeId);
  const awayTeam = getTeam(match.awayId);

  const handleAddEvent = () => {
    if (!playerId) {
      alert("Select a player first.");
      return;
    }
    const store = useAppStore.getState();
    const player = store.players.find(
      (p) => p.id === Number(playerId)
    );
    const teamId = player?.teamId ?? (homePlayers.some((p) => p.id === Number(playerId)) ? match.homeId : match.awayId);
    const newEvent: MatchEvent = {
      playerId: Number(playerId),
      type: eventType,
      teamId,
    };
    const updatedEvents = [...events, newEvent];
    updateMatch(match.id, "events", updatedEvents);

    if (player) {
      const field = STAT_FIELD[eventType];
      updatePlayer(Number(playerId), {
        [field]: ((player[field] as number) || 0) + 1,
      });
    }
    useAppStore.getState().recalculateRatings();
  };

  const handleRemoveEvent = (index: number) => {
    const event = events[index];
    if (!event) return;
    const updatedEvents = events.filter((_, i) => i !== index);
    updateMatch(match.id, "events", updatedEvents);

    const store = useAppStore.getState();
    const player = store.players.find(
      (p) => p.id === event.playerId
    );
    if (player) {
      const field = STAT_FIELD[event.type];
      updatePlayer(event.playerId, {
        [field]: Math.max(0, ((player[field] as number) || 0) - 1),
      });
    }
    useAppStore.getState().recalculateRatings();
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-muted uppercase tracking-wider">
        Match Events
      </h4>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-muted mb-1">
            Player
          </label>
          <select
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            className="input text-sm py-1.5"
          >
            <option value="">Select Player</option>
            {homePlayers.length > 0 && (
              <optgroup label={homeTeam?.name || "Home"}>
                {homePlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} #{p.number}
                  </option>
                ))}
              </optgroup>
            )}
            {awayPlayers.length > 0 && (
              <optgroup label={awayTeam?.name || "Away"}>
                {awayPlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} #{p.number}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs text-muted mb-1">
            Event Type
          </label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="input text-sm py-1.5"
          >
            {EVENT_TYPES.map((et) => (
              <option key={et.value} value={et.value}>
                {et.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleAddEvent}
          className="btn-primary text-sm py-1.5"
        >
          Add Event
        </button>
      </div>

      {events.length > 0 && (
        <div className="space-y-1">
          {events.map((event, i) => {
            const store = useAppStore.getState();
            const player = store.players.find(
              (p) => p.id === event.playerId
            );
            const team = player
              ? store.getTeam(player.teamId)
              : undefined;
            return (
              <div
                key={i}
                className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-surface-2 text-sm"
              >
                <span>
                  <span className="font-medium">
                    {team?.name?.[0] || "?"}
                  </span>{" "}
                  {player?.name || "Unknown"}{" "}
                  <span className="text-muted text-xs">
                    {EVENT_ABBR[event.type] || event.type}
                  </span>
                </span>
                <button
                  onClick={() => handleRemoveEvent(i)}
                  className="text-muted hover:text-danger transition-colors text-lg leading-none"
                  title="Remove event"
                >
                  &times;
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
