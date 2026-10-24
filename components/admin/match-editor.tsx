"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { useResolvedTeams } from "@/lib/hooks/use-resolved-teams";
import { allMatches } from "@/lib/logic/standings";
import { fixtureIssue } from "@/lib/logic/validation";
import { matchMeta } from "@/lib/utils/helpers";
import { AddEventModal } from "@/components/fixtures/add-event-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ChevronDown, ChevronRight, AlertCircle, Clock3, Plus } from "lucide-react";
import { TimeInput } from "../shared/time-input";
import { useToast } from "@/components/ui/toast";
import { useQueryClient } from "@tanstack/react-query";

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
  const [eventMatchId, setEventMatchId] = useState<number | null>(null);
  const [assigningEventId, setAssigningEventId] = useState<number | null>(null);

  const currentSeasonId = useAppStore((s) => s.currentSeasonId);
  const teams = useResolvedTeams(currentSeasonId);
  const fixtures = useAppStore((s) => s.fixtures);
  const players = useAppStore((s) => s.players);
  const updateMatch = useAppStore((s) => s.updateMatch);
  const getTeam = useAppStore((s) => s.getTeam);
  const toast = useToast();
  const queryClient = useQueryClient();

  const matches = allMatches(fixtures);

  const assignPlayerToEvent = async (
    match: (typeof matches)[number],
    event: NonNullable<(typeof matches)[number]["events"]>[number],
    playerId: number
  ) => {
    if (!event.id || assigningEventId != null) return;
    setAssigningEventId(event.id);
    try {
      const response = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to assign player.");
      updateMatch(match.id, "events", (match.events || []).map((item) =>
        item.id === event.id ? { ...item, playerId } : item
      ));
      if (match.season_id) {
        queryClient.invalidateQueries({ queryKey: ["season-statistics", match.season_id] });
      }
      toast.success("Player assigned to goal.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to assign player.");
    } finally {
      setAssigningEventId(null);
    }
  };

  const statusLabel: Record<string, string> = {
    scheduled: "Scheduled",
    "in-progress": "In Progress",
    live: "Live",
    completed: "Completed",
  };

  const statusTone: Record<string, string> = {
    scheduled: "bg-surface-2 text-muted",
    "in-progress": "bg-accent/10 text-accent",
    live: "bg-brand/10 text-brand",
    completed: "bg-muted/10 text-muted",
  };

  const toggleExpanded = (id: number) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const handleFieldChange = (matchId: number, field: string, value: string | number | null) => {
    const normalized = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
    updateMatch(matchId, field, normalized);
  };

  const handleTeamChange = (matchId: number, field: "homeId" | "awayId", value: string) => {
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
          <div key={match.id} className="card overflow-hidden">
            <div
              onClick={() => toggleExpanded(match.id)}
              className="w-full flex flex-col sm:grid sm:grid-cols-[auto_1fr_auto] items-start sm:items-center gap-3 sm:gap-4 px-5 py-4 hover:bg-surface-2/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                {isOpen ? (
                  <ChevronDown size={16} className="shrink-0 text-muted" />
                ) : (
                  <ChevronRight size={16} className="shrink-0 text-muted" />
                )}
                <div className="text-xs uppercase tracking-[0.25em] text-muted">
                  {statusLabel[match.status] || match.status}
                </div>
              </div>

              <div className="grid gap-3">
                <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-line bg-surface shadow-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    {home?.logo_url && (
                      <img
                        src={home.logo_url}
                        alt={home.name}
                        className="w-8 h-8 rounded object-cover shrink-0"
                      />
                    )}
                    <span className="text-sm font-semibold truncate">{home?.name || "?"}</span>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    <Input
                      containerClassName="w-auto"
                      type="number"
                      min={0}
                      max={99}
                      value={match.homeScore ?? ""}
                      onChange={(e) => handleFieldChange(match.id, "homeScore", e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-12 sm:w-16 text-xl sm:text-2xl font-bold text-center py-1"
                      aria-label="Home score"
                    />
                    <span className="text-xl sm:text-2xl font-bold text-muted">-</span>
                    <Input
                      containerClassName="w-auto"
                      type="number"
                      min={0}
                      max={99}
                      value={match.awayScore ?? ""}
                      onChange={(e) => handleFieldChange(match.id, "awayScore", e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-12 sm:w-16 text-xl sm:text-2xl font-bold text-center py-1"
                      aria-label="Away score"
                    />
                  </div>

                  <div className="flex items-center gap-2 min-w-0 justify-end">
                    <span className="text-sm font-semibold truncate">{away?.name || "?"}</span>
                    {away?.logo_url && (
                      <img
                        src={away.logo_url}
                        alt={away.name}
                        className="w-8 h-8 rounded object-cover shrink-0"
                      />
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted">
                  <div className="flex items-center gap-1">
                    <Clock3 size={12} />
                    <span>{match.date || "Date not set"}</span>
                    {match.time ? <span>• {match.time}</span> : null}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 text-right">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone[match.status]}`}
                >
                  {statusLabel[match.status] || match.status}
                </span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {issue && (
                    <span className="rounded-full bg-danger/10 text-danger px-2 py-1 text-xs font-medium flex items-center gap-1">
                      <AlertCircle size={12} />
                      {issue}
                    </span>
                  )}
                  {match.manualEdited && (
                    <span className="rounded-full bg-accent/10 text-accent px-2 py-1 text-xs font-medium">
                      Manual
                    </span>
                  )}
                  {match.autoAdjusted && (
                    <span className="rounded-full bg-brand/10 text-brand px-2 py-1 text-xs font-medium">
                      Adjusted
                    </span>
                  )}
                  {locked && (
                    <span className="rounded-full bg-muted/10 text-muted px-2 py-1 text-xs font-medium">
                      Locked
                    </span>
                  )}
                </div>
              </div>
            </div>

            {isOpen && (
              <div className="border-t border-line px-5 py-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="me-home-team" className="block text-xs text-muted mb-1">
                      Home Team
                    </label>
                    <Select
                      id="me-home-team"
                      value={match.homeId}
                      onChange={(e) => handleTeamChange(match.id, "homeId", e.target.value)}
                      disabled={locked}
                      className="text-sm py-1.5"
                    >
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label htmlFor="me-away-team" className="block text-xs text-muted mb-1">
                      Away Team
                    </label>
                    <Select
                      id="me-away-team"
                      value={match.awayId}
                      onChange={(e) => handleTeamChange(match.id, "awayId", e.target.value)}
                      disabled={locked}
                      className="text-sm py-1.5"
                    >
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label htmlFor="me-status" className="block text-xs text-muted mb-1">
                      Status
                    </label>
                    <Select
                      id="me-status"
                      value={match.status}
                      onChange={(e) => handleFieldChange(match.id, "status", e.target.value)}
                      className="text-sm py-1.5"
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </Select>
                  </div>
                  <div>
                    <label htmlFor="me-date" className="block text-xs text-muted mb-1">
                      Date
                    </label>
                    <Input
                      id="me-date"
                      type="date"
                      value={match.date || ""}
                      onChange={(e) => handleFieldChange(match.id, "date", e.target.value)}
                      className="text-sm py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">Time</label>
                    <TimeInput
                      value={match.time || ""}
                      onChange={(val) => handleFieldChange(match.id, "time", val)}
                    />
                  </div>
                  <div>
                    <label htmlFor="me-venue" className="block text-xs text-muted mb-1">
                      Venue
                    </label>
                    <Input
                      id="me-venue"
                      type="text"
                      value={match.venue || ""}
                      onChange={(e) => handleFieldChange(match.id, "venue", e.target.value)}
                      className="text-sm py-1.5"
                      placeholder="Main pitch"
                    />
                  </div>
                </div>

                <hr className="border-line" />

                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-muted uppercase tracking-wider">
                      Match Events
                    </h4>
                    <Button
                      variant="secondary"
                      className="text-xs py-1 px-3"
                      onClick={() => setEventMatchId(match.id)}
                    >
                      <Plus size={12} />
                      Add Event
                    </Button>
                  </div>

                  {(match.events || []).length > 0 && (
                    <div className="space-y-1">
                      {(match.events || []).map((event, i) => {
                        const store = useAppStore.getState();
                        const player = store.players.find((p) => p.id === event.playerId);
                        const team = player ? store.getTeam(player.teamId) : store.getTeam(event.teamId ?? -1);
                        return (
                          <div
                            key={i}
                            className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-surface-2 text-sm"
                          >
                            <span>
                              <span className="font-medium">{team?.name?.[0] || "?"}</span>{" "}
                              {player?.name || (event.playerId == null && event.type === "goal" ? "Scorer to be assigned" : event.playerId == null ? "Player unavailable" : "Unknown")}{" "}
                              <span className="text-muted text-xs">{event.type}</span>
                            </span>
                            {event.type === "goal" && event.playerId == null && event.teamId != null && event.id && (
                              <select
                                aria-label={`Assign player to ${event.type} for ${team?.name || "team"}`}
                                disabled={assigningEventId != null}
                                defaultValue=""
                                onChange={(change) => {
                                  const selected = Number(change.target.value);
                                  if (selected) void assignPlayerToEvent(match, event, selected);
                                }}
                                className="max-w-40 rounded-lg border border-line bg-surface px-2 py-1 text-xs"
                              >
                                <option value="">Add player later…</option>
                                {players.filter((candidate) => candidate.teamId === event.teamId).map((candidate) => (
                                  <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {eventMatchId === match.id && (
                    <AddEventModal
                      match={match}
                      homeTeamName={home?.name || "Home"}
                      awayTeamName={away?.name || "Away"}
                      onClose={() => setEventMatchId(null)}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
