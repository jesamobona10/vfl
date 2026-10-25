"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Match, Player } from "@/lib/types";
import { CheckCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitMatchEvent, finishMatch } from "@/lib/match-events";

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

interface AddEventModalProps {
  match: Match;
  homeTeamName: string;
  awayTeamName: string;
  onClose: () => void;
  initialMinute?: number;
  /** Preselects an event type (match mode's big Goal/Card buttons). */
  initialType?: string;
  /** Loads the full organization roster, including players not registered to this season. */
  organizationId?: string;
}

export function AddEventModal({
  match,
  homeTeamName,
  awayTeamName,
  onClose,
  initialMinute,
  initialType,
  organizationId,
}: AddEventModalProps) {
  const [selectedType, setSelectedType] = useState<string>(initialType ?? "goal");
  const [playerSearch, setPlayerSearch] = useState("");
  const [minute, setMinute] = useState(initialMinute == null ? "" : String(initialMinute));
  const [showAllTypes, setShowAllTypes] = useState(false);
  const [saving, setSaving] = useState(false);

  const storePlayers = useAppStore((s) => s.players);
  const [organizationPlayers, setOrganizationPlayers] = useState<Player[] | null>(null);
  const [loadingOrganizationPlayers, setLoadingOrganizationPlayers] = useState(Boolean(organizationId));
  const players = organizationPlayers ?? storePlayers;
  const queryClient = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    fetch(`/api/players?org_id=${encodeURIComponent(organizationId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load organization players.");
        return response.json() as Promise<{ players?: Player[] }>;
      })
      .then((body) => {
        if (active) setOrganizationPlayers(body.players || []);
      })
      .catch(() => {
        // Keep the season-scoped store roster as a fallback if the full roster
        // cannot be loaded for this account.
      })
      .finally(() => {
        if (active) setLoadingOrganizationPlayers(false);
      });
    return () => { active = false; };
  }, [organizationId]);

  const invalidateStandings = () => {
    void queryClient.invalidateQueries({ queryKey: ["season-standings"] });
    void queryClient.invalidateQueries({ queryKey: ["season-statistics"] });
    void queryClient.invalidateQueries({ queryKey: ["players"] });
    void queryClient.invalidateQueries({ queryKey: ["org-season-players"] });
    void queryClient.invalidateQueries({ queryKey: ["org-season-fixtures"] });
    void queryClient.invalidateQueries({ queryKey: ["teams"] });
    void queryClient.invalidateQueries({ queryKey: ["org-season-teams"] });
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
      minute: minute ? Number(minute) : undefined,
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

  const handleUnattributedGoal = (teamId: number) => {
    if (saving || selectedType !== "goal") return;
    setSaving(true);
    onClose();
    void submitMatchEvent({
      match,
      playerId: null,
      teamId,
      type: "goal",
      minute: minute ? Number(minute) : undefined,
      onSettled: invalidateStandings,
    }).then(({ undo }) => {
      const teamName = teamId === match.homeId ? homeTeamName : awayTeamName;
      toast.success(`Goal for ${teamName} recorded. Add the player later to update individual stats.`, {
        action: { label: "Undo", onAction: undo },
      });
    }).catch(() => {
      toast.error("The goal could not be saved. Please refresh and try again.");
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
      subtitle={`${homeTeamName} vs ${awayTeamName} · ${initialMinute ? `${initialMinute}′` : "Choose a player or team"}`}
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
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">Match minute <span className="font-normal normal-case">(optional)</span></span>
          <Input
            type="number"
            min={0}
            max={130}
            value={minute}
            onChange={(event) => setMinute(event.target.value)}
            placeholder="e.g. 67"
          />
        </label>

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
          {([ [match.homeId, homeTeamName, homePlayers], [match.awayId, awayTeamName, awayPlayers] ] as const).map(([teamId, teamName, teamPlayers]) => (
            <section key={teamName}>
              <p className="mb-1.5 text-xs font-semibold text-ink-3">{teamName}</p>
              {loadingOrganizationPlayers ? (
                <p className="py-2 text-xs text-muted">Loading team players…</p>
              ) : teamPlayers.length > 0 ? (
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
              {selectedType === "goal" && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleUnattributedGoal(teamId)}
                  className="mt-2 w-full rounded-xl border border-brand/30 bg-brand/5 px-3 py-2.5 text-left text-xs font-semibold text-brand hover:bg-brand/10 disabled:opacity-50"
                >
                  Record goal for {teamName} · add player later
                </button>
              )}
            </section>
          ))}
        </div>
      </div>
    </Modal>
  );
}
