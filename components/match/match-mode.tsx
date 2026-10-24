"use client";

import { useState } from "react";
import Image from "next/image";
import { Flag, Play, Undo2 } from "lucide-react";
import type { Match, Team } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { removeMatchEvent, startMatch, finishMatch } from "@/lib/match-events";
import { useLiveClock } from "@/components/live/live-clock";
import { AddEventModal } from "@/components/fixtures/add-event-modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { LiveClockSettings } from "@/lib/logic/live";

/** Grace window before a removed match event is actually deleted on the server. */
const UNDO_WINDOW_MS = 5000;

const EVENT_LABEL: Record<string, string> = {
  goal: "Goal",
  assist: "Assist",
  "own-goal": "Own goal",
  yellow: "Yellow card",
  red: "Red card",
  save: "Save",
  "penalty-save": "Penalty save",
  "clean-sheet": "Clean sheet",
  motm: "Man of the match",
  error: "Error",
  "penalty-conceded": "Penalty conceded",
  tackle: "Tackle",
  interception: "Interception",
  block: "Block",
  aerial: "Aerial duel",
  "goal-conceded": "Goal conceded",
  "match-win": "Match win",
  "bonus-5-saves": "5+ saves",
};

interface MatchModeProps {
  match: Match;
  homeTeam: Team | undefined;
  awayTeam: Team | undefined;
  settings?: LiveClockSettings;
  onUpdated: () => void;
}

function TeamBadge({ team }: { team: Team | undefined }) {
  if (team?.logo_url) {
    return (
      <Image
        src={team.logo_url}
        alt=""
        width={48}
        height={48}
        className="h-12 w-12 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-lg font-bold text-muted">
      {team?.name?.[0] || "?"}
    </div>
  );
}

/**
 * Phone-first match-day console: scoreboard, large Goal/Card buttons, a live
 * timeline with undo, and start/finish — all on one screen. Every write goes
 * through the `lib/match-events` seam.
 */
export function MatchMode({ match, homeTeam, awayTeam, settings, onUpdated }: MatchModeProps) {
  const [pendingType, setPendingType] = useState<{ teamId: number; type: string } | null>(null);
  const [confirmingFinish, setConfirmingFinish] = useState(false);
  const [busy, setBusy] = useState(false);
  const players = useAppStore((s) => s.players);
  const toast = useToast();
  const phase = useLiveClock(match.live_started_at, settings);

  const events = match.events || [];
  const minute =
    phase && phase.label !== "HT" && phase.label !== "FT" ? phase.minute : undefined;
  const isCompleted = match.status === "completed";
  const isLive = match.status === "live" || match.status === "in-progress";

  const getPlayerName = (playerId: number | null) =>
    playerId == null ? "Player unavailable" : players.find((p) => p.id === playerId)?.name || "Unknown";

  const handleStart = async () => {
    setBusy(true);
    try {
      await startMatch(match.id);
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to start the match.");
    } finally {
      setBusy(false);
    }
  };

  const handleFinish = async () => {
    if (!confirmingFinish) {
      setConfirmingFinish(true);
      return;
    }
    setBusy(true);
    try {
      await finishMatch(match.id, match.homeScore ?? 0, match.awayScore ?? 0);
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to finish the match.");
    } finally {
      setBusy(false);
      setConfirmingFinish(false);
    }
  };

  const handleRemove = (index: number) => {
    const removed = removeMatchEvent({ match, index, onSettled: onUpdated });
    if (!removed) return;
    const timer = setTimeout(removed.persistDelete, UNDO_WINDOW_MS);
    toast.info("Event removed", {
      action: {
        label: "Undo",
        onAction: () => {
          clearTimeout(timer);
          removed.undo();
        },
      },
      durationMs: UNDO_WINDOW_MS,
    });
  };

  const teamColumns: { team: Team | undefined; teamId: number }[] = [
    { team: homeTeam, teamId: match.homeId },
    { team: awayTeam, teamId: match.awayId },
  ];

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-24">
      {/* Scoreboard */}
      <div className="card px-4 py-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex min-w-0 flex-col items-center gap-2 text-center">
            <TeamBadge team={homeTeam} />
            <span className="truncate text-sm font-semibold">{homeTeam?.name || "Home"}</span>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold tabular-nums">
              {match.homeScore ?? 0} - {match.awayScore ?? 0}
            </div>
            <div className="mt-1 text-xs uppercase tracking-widest text-muted">
              {isCompleted
                ? "Full time"
                : phase?.label === "HT"
                  ? "Half-time"
                  : isLive
                    ? `${minute ?? 0}'`
                    : "Not started"}
            </div>
          </div>
          <div className="flex min-w-0 flex-col items-center gap-2 text-center">
            <TeamBadge team={awayTeam} />
            <span className="truncate text-sm font-semibold">{awayTeam?.name || "Away"}</span>
          </div>
        </div>

        <div className="mt-4 flex justify-center">
          {!isLive && !isCompleted && (
            <Button onClick={handleStart} loading={busy} leftIcon={<Play size={16} />}>
              Start match
            </Button>
          )}
          {isLive && !confirmingFinish && (
            <Button
              variant="ghost"
              onClick={handleFinish}
              className="text-danger"
              leftIcon={<Flag size={16} />}
            >
              Finish match
            </Button>
          )}
          {isLive && confirmingFinish && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirmingFinish(false)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleFinish} loading={busy}>
                Confirm finish
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Quick event buttons */}
      {!isCompleted && (
        <div className="grid grid-cols-2 gap-3">
          {teamColumns.map(({ team, teamId }) => (
            <div key={teamId} className="card space-y-2 p-3">
              <p className="truncate text-center text-xs font-semibold uppercase tracking-wider text-muted">
                {team?.name || "Team"}
              </p>
              <button
                type="button"
                onClick={() => setPendingType({ teamId, type: "goal" })}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-6 text-base font-bold text-white active:scale-[0.98]"
              >
                Goal
              </button>
              <button
                type="button"
                onClick={() => setPendingType({ teamId, type: "yellow" })}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-warn-500 px-4 py-3 text-sm font-bold text-ink active:scale-[0.98]"
              >
                Card
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      <div className="card p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">Timeline</h3>
        {events.length === 0 ? (
          <p className="py-2 text-sm text-muted">No events yet.</p>
        ) : (
          <ol className="space-y-2">
            {events.map((event, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted">
                  {event.minute ? `${event.minute}'` : "—"}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{EVENT_LABEL[event.type] || event.type}</span>{" "}
                  <span className="text-muted">{event.playerId == null && event.type === "goal" ? "Scorer to be assigned" : getPlayerName(event.playerId)}{event.playerId == null && event.teamId != null ? ` · ${event.teamId === match.homeId ? homeTeam?.name : awayTeam?.name}` : ""}</span>
                </span>
                {!isCompleted && (
                  <button
                    type="button"
                    onClick={() => handleRemove(i)}
                    aria-label={`Remove event for ${getPlayerName(event.playerId)}`}
                    className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-danger"
                  >
                    <Undo2 size={16} />
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      {pendingType && (
        <AddEventModal
          match={match}
          homeTeamName={homeTeam?.name || "Home"}
          awayTeamName={awayTeam?.name || "Away"}
          initialMinute={minute}
          initialType={pendingType.type}
          onClose={() => setPendingType(null)}
        />
      )}
    </div>
  );
}
