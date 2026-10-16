"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Match } from "@/lib/types";
import { CheckCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitMatchEvent, finishMatch } from "@/lib/match-events";
import { EVENT_CATEGORIES } from "@/lib/logic/events";

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

interface AddEventModalProps {
  match: Match;
  homeTeamName: string;
  awayTeamName: string;
  onClose: () => void;
  initialMinute?: number;
  /** Preselects an event type (match mode's big Goal/Card buttons). */
  initialType?: string;
}

export function AddEventModal({
  match,
  homeTeamName,
  awayTeamName,
  onClose,
  initialMinute,
  initialType,
}: AddEventModalProps) {
  const [selectedType, setSelectedType] = useState<string>(initialType ?? "goal");
  const [playerSearch, setPlayerSearch] = useState("");
  const [showAllTypes, setShowAllTypes] = useState(false);
  const [saving, setSaving] = useState(false);

  const players = useAppStore((s) => s.players);
  const queryClient = useQueryClient();
  const toast = useToast();

  const invalidateStandings = () => {
    if (match.season_id) {
      queryClient.invalidateQueries({ queryKey: ["season-standings", match.season_id] });
      queryClient.invalidateQueries({ queryKey: ["season-statistics", match.season_id] });
    }
  };

  const normalizedSearch = playerSearch.trim().toLocaleLowerCase();
  const filterPlayers = (teamId: number) => players
    .filter((player) => player.teamId === teamId)
    .filter((player) => !normalizedSearch ||
      player.name.toLocaleLowerCase().includes(normalizedSearch) ||
      String(player.number || "").includes(normalizedSearch));
  const homePlayers = filterPlayers(match.homeId);
  const awayPlayers = filterPlayers(match.awayId);

  const handleSelectPlayer = (playerId: number) => {
    if (saving) return;

    const player = players.find((p) => p.id === playerId);
    if (!player) return;
    const teamId = player.teamId ?? match.homeId;

    setSaving(true);
    onClose();

    void submitMatchEvent({
      match,
      playerId,
      teamId,
      type: selectedType,
      minute: initialMinute,
      onSettled: invalidateStandings,
    })
      .then(({ undo }) => {
        toast.success(`${selectedLabel} added.`, {
          action: { label: "Undo", onAction: undo },
        });
      })
      .catch(() => {
        toast.error("The event was added on this screen but could not be saved. Please refresh and try again.");
      });
  };

  const handleMarkComplete = async () => {
    const home = match.homeScore ?? 0;
    const away = match.awayScore ?? 0;
    try {
      await finishMatch(match.id, home, away);
      invalidateStandings();
    } catch {
      // persist silently
    }
    onClose();
  };

  const selectedLabel =
    EVENT_CATEGORIES.flatMap((c) => c.types).find((t) => t.value === selectedType)?.label ||
    selectedType;
  const quickTypes = EVENT_CATEGORIES.flatMap((category) => category.types)
    .filter((type) => ["goal", "assist", "own-goal", "yellow", "red"].includes(type.value));

  return (
    <Modal
      open
      onClose={onClose}
      title="Quick match event"
      subtitle={`${homeTeamName} vs ${awayTeamName} · ${initialMinute ? `${initialMinute}′` : "Choose a player"}`}
      className="max-w-md"
      footer={
        match.status !== "completed" ? (
          <div className="flex justify-center">
            <Button
              className="text-sm py-1.5 px-4"
              onClick={handleMarkComplete}
            >
              <CheckCircle size={14} />
              MARK COMPLETED
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Event type</p>
            <span className="text-xs text-muted">Selected: {selectedLabel}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                aria-pressed={selectedType === type.value}
                onClick={() => setSelectedType(type.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  selectedType === type.value
                    ? `${EVENT_COLOR[type.value]} border-current`
                    : "border-line bg-surface text-ink-3 hover:bg-surface-2"
                }`}
              >
                {type.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowAllTypes((shown) => !shown)}
              aria-expanded={showAllTypes}
              className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-3 hover:bg-surface-2"
            >
              {showAllTypes ? "Fewer" : "More events"}
            </button>
          </div>
          {showAllTypes && (
            <div className="mt-3 max-h-none space-y-3 overflow-visible rounded-xl border border-line p-3 sm:max-h-36 sm:overflow-y-auto">
              {EVENT_CATEGORIES.map((category) => (
                <div key={category.label}>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                    {category.label}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {category.types.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        aria-pressed={selectedType === type.value}
                        onClick={() => setSelectedType(type.value)}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                          selectedType === type.value
                            ? `${EVENT_COLOR[type.value]} border-current font-semibold`
                            : "border-line text-ink-3 hover:bg-surface-2"
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">Player</span>
          <Input
            type="search"
            value={playerSearch}
            onChange={(event) => setPlayerSearch(event.target.value)}
            placeholder="Search name or shirt number"
          />
        </label>

        {/* One scroll region on mobile: the dialog itself. A nested scroller here
            fights the on-screen keyboard for scroll gestures. */}
        <div className="max-h-none space-y-3 sm:max-h-72 sm:overflow-y-auto">
          {([ [homeTeamName, homePlayers], [awayTeamName, awayPlayers] ] as const).map(([teamName, teamPlayers]) => (
            <section key={teamName}>
              <p className="mb-1.5 text-xs font-semibold text-ink-3">{teamName}</p>
              {teamPlayers.length > 0 ? (
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {teamPlayers.map((player) => (
                    <button
                      key={player.id}
                      type="button"
                      disabled={saving}
                      onClick={() => handleSelectPlayer(player.id)}
                      className="flex min-w-0 items-center gap-2 rounded-xl border border-line px-2.5 py-2 text-left transition-colors hover:border-brand/40 hover:bg-brand/5 disabled:opacity-50"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-bold text-muted">
                        {player.number || "–"}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{player.name}</span>
                      <span className="shrink-0 text-[10px] text-muted">{player.position}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="py-2 text-xs text-muted">
                  {normalizedSearch ? "No matching players." : "No players found for this team."}
                </p>
              )}
            </section>
          ))}
        </div>
      </div>
    </Modal>
  );
}
