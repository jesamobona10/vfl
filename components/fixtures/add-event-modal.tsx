"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Match, MatchEvent, Player } from "@/lib/types";
import { CheckCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";

const EVENT_CATEGORIES = [
  {
    label: "Scoring",
    types: [
      { value: "goal", label: "Goal", abbr: "G" },
      { value: "assist", label: "Assist", abbr: "A" },
      { value: "own-goal", label: "Own Goal", abbr: "OG" },
      { value: "penalty-save", label: "Penalty Save", abbr: "PS" },
    ],
  },
  {
    label: "Discipline",
    types: [
      { value: "yellow", label: "Yellow Card", abbr: "Y" },
      { value: "red", label: "Red Card", abbr: "R" },
    ],
  },
  {
    label: "Goalkeeping",
    types: [
      { value: "save", label: "Save", abbr: "SV" },
      { value: "clean-sheet", label: "Clean Sheet", abbr: "CS" },
      { value: "goal-conceded", label: "Goal Conceded", abbr: "GC" },
      { value: "bonus-5-saves", label: "5+ Saves", abbr: "5+S" },
    ],
  },
  {
    label: "Performance",
    types: [
      { value: "motm", label: "Man of the Match", abbr: "MOTM" },
      { value: "match-win", label: "Match Win", abbr: "W" },
      { value: "error", label: "Error Leading to Goal", abbr: "ERR" },
      { value: "penalty-conceded", label: "Penalty Conceded", abbr: "PC" },
    ],
  },
  {
    label: "Defensive",
    types: [
      { value: "tackle", label: "Tackle", abbr: "T" },
      { value: "interception", label: "Interception", abbr: "INT" },
      { value: "block", label: "Block", abbr: "BLK" },
      { value: "aerial", label: "Aerial Duel Won", abbr: "AD" },
    ],
  },
];

const EVENT_COLOR: Record<string, string> = {
  goal: "bg-brand/20 text-brand",
  assist: "bg-accent/20 text-accent",
  "own-goal": "bg-muted/20 text-muted",
  yellow: "bg-warn-500/20 text-warn-500",
  red: "bg-danger/20 text-danger",
  save: "bg-live-500/20 text-live-500",
  "penalty-save": "bg-live-500/20 text-live-500",
  "clean-sheet": "bg-live-500/20 text-live-500",
  motm: "bg-gold-500/20 text-gold-700",
  error: "bg-warn-500/20 text-warn-500",
  "penalty-conceded": "bg-warn-500/20 text-warn-500",
  tackle: "bg-brand-600/20 text-brand-600",
  interception: "bg-brand-600/20 text-brand-600",
  block: "bg-brand-600/20 text-brand-600",
  aerial: "bg-brand-600/20 text-brand-600",
  "goal-conceded": "bg-danger-500/20 text-danger-500",
  "match-win": "bg-live-500/20 text-live-500",
  "bonus-5-saves": "bg-live-500/20 text-live-500",
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

interface AddEventModalProps {
  match: Match;
  homeTeamName: string;
  awayTeamName: string;
  onClose: () => void;
  initialMinute?: number;
}

function updateMatchScore(
  match: Match,
  playerTeamId: number,
  eventType: string
): { homeScore: number | null; awayScore: number | null } {
  const home = match.homeScore ?? 0;
  const away = match.awayScore ?? 0;

  if (eventType === "goal") {
    if (playerTeamId === match.homeId) return { homeScore: home + 1, awayScore: away };
    return { homeScore: home, awayScore: away + 1 };
  }
  if (eventType === "own-goal") {
    if (playerTeamId === match.homeId) return { homeScore: home, awayScore: away + 1 };
    return { homeScore: home + 1, awayScore: away };
  }
  return { homeScore: match.homeScore, awayScore: match.awayScore };
}

export function AddEventModal({
  match,
  homeTeamName,
  awayTeamName,
  onClose,
  initialMinute,
}: AddEventModalProps) {
  const [step, setStep] = useState<"type" | "player">("type");
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const players = useAppStore((s) => s.players);
  const updateMatch = useAppStore((s) => s.updateMatch);
  const updatePlayer = useAppStore((s) => s.updatePlayer);
  const queryClient = useQueryClient();

  const invalidateStandings = () => {
    if (match.season_id) {
      queryClient.invalidateQueries({ queryKey: ["season-standings", match.season_id] });
      queryClient.invalidateQueries({ queryKey: ["season-statistics", match.season_id] });
    }
  };

  const homePlayers = players.filter((p) => p.teamId === match.homeId);
  const awayPlayers = players.filter((p) => p.teamId === match.awayId);

  const handleSelectType = (type: string) => {
    setSelectedType(type);
    setStep("player");
  };

  const handleSelectPlayer = async (playerId: number) => {
    if (!selectedType) return;

    const player = players.find((p) => p.id === playerId);
    const teamId = player?.teamId ?? match.homeId;
    const minute = initialMinute;
    const newEvent: MatchEvent = { playerId, type: selectedType, teamId, minute };

    const events = [...(match.events || []), newEvent];
    updateMatch(match.id, "events", events);

    const score = updateMatchScore(match, teamId, selectedType);
    updateMatch(match.id, "homeScore", score.homeScore);
    updateMatch(match.id, "awayScore", score.awayScore);

    if (player) {
      const field = STAT_FIELD[selectedType];
      if (field) {
        updatePlayer(playerId, {
          [field]: ((player[field] as number) || 0) + 1,
        });
      }
    }
    useAppStore.getState().recalculateRatings();

    try {
      await fetch(`/api/fixtures/${match.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, teamId, type: selectedType, minute }),
      });
    } catch {
      // persist silently
    }

    if (selectedType === "goal" || selectedType === "own-goal") {
      try {
        const homeScore = score.homeScore ?? 0;
        const awayScore = score.awayScore ?? 0;
        await fetch(`/api/fixtures/${match.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ homeScore, awayScore }),
        });
        invalidateStandings();
      } catch {
        // persist silently
      }
    }

    onClose();
  };

  const handleMarkComplete = async () => {
    const home = match.homeScore ?? 0;
    const away = match.awayScore ?? 0;
    updateMatch(match.id, "homeScore", home);
    updateMatch(match.id, "awayScore", away);
    useAppStore.getState().recalculateRatings();
    try {
      await fetch(`/api/fixtures/${match.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeScore: home, awayScore: away, status: "completed" }),
      });
      invalidateStandings();
    } catch {
      // persist silently
    }
    onClose();
  };

  const selectedLabel =
    EVENT_CATEGORIES.flatMap((c) => c.types).find((t) => t.value === selectedType)?.label ||
    selectedType ||
    "";

  return (
    <Modal
      open
      onClose={onClose}
      title={step === "type" ? "Add Event" : `Add ${selectedLabel}`}
      subtitle={`${homeTeamName} vs ${awayTeamName}`}
      className="max-w-md"
      headerActions={
        step === "player" ? (
          <button
            onClick={() => {
              setStep("type");
              setSelectedType(null);
            }}
            className="text-xs text-muted hover:text-text transition-colors"
          >
            &larr; Back
          </button>
        ) : undefined
      }
      footer={
        match.status !== "completed" ? (
          <div className="flex justify-center">
            <button
              onClick={handleMarkComplete}
              className="btn-primary text-sm py-1.5 px-4 flex items-center gap-1.5"
            >
              <CheckCircle size={14} />
              MARK COMPLETED
            </button>
          </div>
        ) : undefined
      }
    >
        {step === "type" ? (
          <div className="space-y-4 max-h-80 overflow-y-auto">
            {EVENT_CATEGORIES.map((category) => (
              <div key={category.label}>
                <p className="text-xs uppercase tracking-wider text-muted font-semibold mb-2">
                  {category.label}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {category.types.map((t) => {
                    const color = EVENT_COLOR[t.value] || "bg-muted/20 text-muted";
                    return (
                      <button
                        key={t.value}
                        onClick={() => handleSelectType(t.value)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border border-line hover:border-muted/40 transition-colors text-left ${color}`}
                      >
                        <span className="text-xs font-bold uppercase">{t.abbr}</span>
                        <span className="text-xs font-medium">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {homePlayers.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted font-semibold mb-1">
                  {homeTeamName}
                </p>
                {homePlayers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPlayer(p.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl border border-line hover:border-muted/40 hover:bg-surface-2/50 transition-colors text-left"
                  >
                    <span className="w-7 h-7 rounded-full bg-surface-2 flex items-center justify-center text-xs font-bold text-muted">
                      {p.number || "?"}
                    </span>
                    <span className="text-sm font-medium">{p.name}</span>
                    <span className="text-xs text-muted ml-auto">{p.position}</span>
                  </button>
                ))}
              </div>
            )}
            {awayPlayers.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted font-semibold mb-1">
                  {awayTeamName}
                </p>
                {awayPlayers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPlayer(p.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl border border-line hover:border-muted/40 hover:bg-surface-2/50 transition-colors text-left"
                  >
                    <span className="w-7 h-7 rounded-full bg-surface-2 flex items-center justify-center text-xs font-bold text-muted">
                      {p.number || "?"}
                    </span>
                    <span className="text-sm font-medium">{p.name}</span>
                    <span className="text-xs text-muted ml-auto">{p.position}</span>
                  </button>
                ))}
              </div>
            )}
            {homePlayers.length === 0 && awayPlayers.length === 0 && (
              <p className="text-sm text-muted text-center py-8">
                No players found for this match.
              </p>
            )}
          </div>
        )}
    </Modal>
  );
}
