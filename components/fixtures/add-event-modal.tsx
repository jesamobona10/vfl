"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Match, MatchEvent, Player } from "@/lib/types";
import { X, CheckCircle } from "lucide-react";

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
  yellow: "bg-yellow-500/20 text-yellow-400",
  red: "bg-danger/20 text-danger",
  save: "bg-blue-500/20 text-blue-400",
  "penalty-save": "bg-blue-500/20 text-blue-400",
  "clean-sheet": "bg-green-500/20 text-green-400",
  motm: "bg-purple-500/20 text-purple-400",
  error: "bg-orange-500/20 text-orange-400",
  "penalty-conceded": "bg-orange-500/20 text-orange-400",
  tackle: "bg-cyan-500/20 text-cyan-400",
  interception: "bg-cyan-500/20 text-cyan-400",
  block: "bg-cyan-500/20 text-cyan-400",
  aerial: "bg-cyan-500/20 text-cyan-400",
  "goal-conceded": "bg-red-500/20 text-red-400",
  "match-win": "bg-green-500/20 text-green-400",
  "bonus-5-saves": "bg-blue-500/20 text-blue-400",
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
}: AddEventModalProps) {
  const [step, setStep] = useState<"type" | "player">("type");
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const players = useAppStore((s) => s.players);
  const updateMatch = useAppStore((s) => s.updateMatch);
  const updatePlayer = useAppStore((s) => s.updatePlayer);

  const homePlayers = players.filter((p) => p.teamId === match.homeId);
  const awayPlayers = players.filter((p) => p.teamId === match.awayId);

  const handleSelectType = (type: string) => {
    setSelectedType(type);
    setStep("player");
  };

  const handleSelectPlayer = (playerId: number) => {
    if (!selectedType) return;

    const player = players.find((p) => p.id === playerId);
    const teamId = player?.teamId ?? match.homeId;
    const newEvent: MatchEvent = { playerId, type: selectedType, teamId };

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
    onClose();
  };

  const handleMarkComplete = () => {
    const home = match.homeScore ?? 0;
    const away = match.awayScore ?? 0;
    updateMatch(match.id, "homeScore", home);
    updateMatch(match.id, "awayScore", away);
    onClose();
  };

  const selectedLabel =
    EVENT_CATEGORIES.flatMap((c) => c.types).find(
      (t) => t.value === selectedType
    )?.label || selectedType || "";

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-line rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            {step === "player" && (
              <button
                onClick={() => {
                  setStep("type");
                  setSelectedType(null);
                }}
                className="text-xs text-muted hover:text-text transition-colors"
              >
                &larr; Back
              </button>
            )}
            <h3 className="text-lg font-bold">
              {step === "type" ? "Add Event" : `Add ${selectedLabel}`}
            </h3>
          </div>
          <button onClick={onClose} className="btn-icon">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-muted">
          {homeTeamName} vs {awayTeamName}
        </p>

        {step === "type" ? (
          <div className="space-y-4 max-h-80 overflow-y-auto">
            {EVENT_CATEGORIES.map((category) => (
              <div key={category.label}>
                <p className="text-[11px] uppercase tracking-wider text-muted font-semibold mb-2">
                  {category.label}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {category.types.map((t) => {
                    const color = EVENT_COLOR[t.value] || "bg-muted/20 text-muted";
                    return (
                      <button
                        key={t.value}
                        onClick={() => handleSelectType(t.value)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border border-line hover:border-muted/40 transition-colors text-left ${color}`}
                      >
                        <span className="text-xs font-bold uppercase">
                          {t.abbr}
                        </span>
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
                <p className="text-[11px] uppercase tracking-wider text-muted font-semibold mb-1">
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
                    <span className="text-[11px] text-muted ml-auto">
                      {p.position}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {awayPlayers.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted font-semibold mb-1">
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
                    <span className="text-[11px] text-muted ml-auto">
                      {p.position}
                    </span>
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

        {match.status !== "completed" && (
          <div className="flex justify-center pt-2 border-t border-line">
            <button
              onClick={handleMarkComplete}
              className="btn-primary text-sm py-1.5 px-4 flex items-center gap-1.5"
            >
              <CheckCircle size={14} />
              MARK COMPLETED
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
