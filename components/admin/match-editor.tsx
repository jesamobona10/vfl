"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { allMatches } from "@/lib/logic/standings";
import { fixtureIssue } from "@/lib/logic/validation";
import { matchMeta } from "@/lib/utils/helpers";
import { EventLog } from "./event-log";
import { ChevronDown, ChevronRight, AlertCircle } from "lucide-react";

function teamLocked(match: ReturnType<typeof allMatches>[number]): boolean {
  return (
    match.status === "completed" ||
    match.status === "scheduled" ||
    match.status === "in-progress" ||
    match.status === "live" ||
    match.manualEdited === true
  );
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  goal: "Goal",
  assist: "Assist",
  "own-goal": "Own Goal",
  yellow: "Yellow Card",
  red: "Red Card",
  save: "Save",
  "penalty-save": "Penalty Save",
  "clean-sheet": "Clean Sheet",
  motm: "MOTM",
  error: "Error",
  "penalty-conceded": "Penalty Conceded",
  tackle: "Tackle",
  interception: "Interception",
  block: "Block",
  aerial: "Aerial Duel",
  "goal-conceded": "Goal Conceded",
  "match-win": "Match Win",
  "bonus-5-saves": "5+ Saves Bonus",
};

export function MatchEditor() {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const teams = useAppStore((s) => s.teams);
  const fixtures = useAppStore((s) => s.fixtures);
  const players = useAppStore((s) => s.players);
  const updateMatch = useAppStore((s) => s.updateMatch);
  const getTeam = useAppStore((s) => s.getTeam);
  const teamName = useAppStore((s) => s.teamName);

  const matches = allMatches(fixtures);

  const toggleExpanded = (id: number) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const handleFieldChange = (
    matchId: number,
    field: string,
    value: string | number | null
  ) => {
    updateMatch(matchId, field, value);
  };

  const handleTeamChange = (
    matchId: number,
    field: "homeId" | "awayId",
    value: string
  ) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match || teamLocked(match)) return;
    updateMatch(matchId, field, value);
  };

  if (!matches.length) {
    return (
      <div className="card p-8 text-center text-muted">
        <p>Generate fixtures before entering scores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {matches.map((match) => {
        const home = getTeam(match.homeId);
        const away = getTeam(match.awayId);
        const locked = teamLocked(match);
        const isOpen = expanded.has(match.id);
        const issue = fixtureIssue(match, fixtures);

        return (
          <div
            key={match.id}
            className="card overflow-hidden"
          >
            <button
              onClick={() => toggleExpanded(match.id)}
              className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-surface-2/50 transition-colors"
            >
              {isOpen ? (
                <ChevronDown size={16} className="shrink-0 text-muted" />
              ) : (
                <ChevronRight size={16} className="shrink-0 text-muted" />
              )}
              <div className="flex-1 min-w-0">
                <strong className="text-sm">
                  Round {match.round}: {home?.name || "?"} vs{" "}
                  {away?.name || "?"}
                </strong>
                <span className="text-xs text-muted ml-2">
                  {matchMeta(match)}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {issue && (
                  <span className="text-xs text-danger flex items-center gap-1">
                    <AlertCircle size={12} />
                    {issue}
                  </span>
                )}
                {match.manualEdited && (
                  <span className="text-xs text-accent">Manual</span>
                )}
                {match.autoAdjusted && (
                  <span className="text-xs text-blue-500">Adjusted</span>
                )}
                {locked && (
                  <span className="text-xs text-muted bg-surface-2 rounded px-1.5 py-0.5">
                    Locked
                  </span>
                )}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-line px-5 py-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-muted mb-1">
                      Home Team
                    </label>
                    <select
                      value={match.homeId}
                      onChange={(e) =>
                        handleTeamChange(match.id, "homeId", e.target.value)
                      }
                      disabled={locked}
                      className="input text-sm py-1.5"
                    >
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">
                      Away Team
                    </label>
                    <select
                      value={match.awayId}
                      onChange={(e) =>
                        handleTeamChange(match.id, "awayId", e.target.value)
                      }
                      disabled={locked}
                      className="input text-sm py-1.5"
                    >
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">
                      Home Score
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={match.homeScore ?? ""}
                      onChange={(e) =>
                        handleFieldChange(
                          match.id,
                          "homeScore",
                          e.target.value
                        )
                      }
                      className="input text-sm py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">
                      Away Score
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={match.awayScore ?? ""}
                      onChange={(e) =>
                        handleFieldChange(
                          match.id,
                          "awayScore",
                          e.target.value
                        )
                      }
                      className="input text-sm py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">
                      Status
                    </label>
                    <select
                      value={match.status}
                      onChange={(e) =>
                        handleFieldChange(match.id, "status", e.target.value)
                      }
                      className="input text-sm py-1.5"
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={match.date || ""}
                      onChange={(e) =>
                        handleFieldChange(match.id, "date", e.target.value)
                      }
                      className="input text-sm py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">
                      Time
                    </label>
                    <input
                      type="time"
                      value={match.time || ""}
                      onChange={(e) =>
                        handleFieldChange(match.id, "time", e.target.value)
                      }
                      className="input text-sm py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">
                      Venue
                    </label>
                    <input
                      type="text"
                      value={match.venue || ""}
                      onChange={(e) =>
                        handleFieldChange(match.id, "venue", e.target.value)
                      }
                      className="input text-sm py-1.5"
                      placeholder="Main pitch"
                    />
                  </div>
                </div>

                <hr className="border-line" />

                <EventLog
                  match={match}
                  homePlayers={players.filter(
                    (p) => p.teamId === match.homeId
                  )}
                  awayPlayers={players.filter(
                    (p) => p.teamId === match.awayId
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
