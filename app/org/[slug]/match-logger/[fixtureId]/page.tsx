"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useCan } from "@/lib/hooks/use-can";
import {
  useDeleteMatchEvent,
  useLogMatchEvent,
  useMatchEvents,
} from "@/lib/hooks/use-match-events";
import { usePlayers } from "@/lib/hooks/use-players";
import { useToast } from "@/components/ui/toast";
import { EmptyState, LoadingState } from "@/components/shared/skeleton";
import { Scoreboard } from "@/components/match-logger/scoreboard";
import { TeamToggle } from "@/components/match-logger/team-toggle";
import { EventKeypad } from "@/components/match-logger/event-keypad";
import { Timeline } from "@/components/match-logger/timeline";
import { UndoBar } from "@/components/match-logger/undo-bar";
import { SyncChip } from "@/components/match-logger/sync-chip";
import { LoggerSettings } from "@/components/match-logger/logger-settings";
import { useWakeLock } from "@/lib/match-logger/use-wake-lock";
import {
  PlayerPickerSheet,
  type PickerConfirmPayload,
} from "@/components/match-logger/player-picker-sheet";
import { newClientEventId } from "@/lib/match-logger/submit-match-event";
import { livePhase, liveSettings } from "@/lib/logic/live";
import {
  eventTypeLabel,
  isEventType,
  secondaryEventTypes,
} from "@/lib/logic/events";
import { useCompetition } from "@/lib/hooks/use-competitions";
import type { LiveFixtureTeam } from "@/lib/types";
import styles from "@/components/match-logger/match-logger.module.css";

const UNDO_WINDOW_MS = 5000;

interface UndoState {
  ids: number[];
  message: string;
  expiresAt: number;
}

export default function MatchLoggerPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const fixtureId = Number(params.fixtureId);
  const { success, error: toastError } = useToast();

  const { allowed: canEdit } = useCan("match.edit");

  const fixtureQuery = useMatchEvents(Number.isFinite(fixtureId) ? fixtureId : undefined);
  const fixture = fixtureQuery.data;
  const match = fixture?.match;
  const organizationId = fixture?.organizationId ?? null;

  const playersQuery = usePlayers(organizationId);
  const allPlayers = useMemo(
    () => playersQuery.data?.players ?? [],
    [playersQuery.data]
  );

  const logEvent = useLogMatchEvent(fixtureId);
  const deleteEvent = useDeleteMatchEvent(fixtureId);

  const { data: competition } = useCompetition(match?.competition_id ?? undefined);
  const settings = useMemo(
    () => (competition ? liveSettings(competition.settings) : undefined),
    [competition]
  );

  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [pickerType, setPickerType] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [paused, setPaused] = useState(false);
  const [frozenAt, setFrozenAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  // Keep the screen awake for the whole match (guide §5).
  useWakeLock(true);

  const homeTeamId = match?.home_team_id ?? match?.homeId ?? null;
  const awayTeamId = match?.away_team_id ?? match?.awayId ?? null;

  // Derive the active team instead of syncing it with an effect: default to the
  // home side, and fall back if a stale selection no longer matches the fixture.
  const activeTeamId =
    selectedTeamId != null &&
    (selectedTeamId === homeTeamId || selectedTeamId === awayTeamId)
      ? selectedTeamId
      : homeTeamId;

  // Advance the clock once a second while it is not paused.
  useEffect(() => {
    if (paused) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [paused]);

  // Re-render while an undo window is open so the countdown stays accurate.
  // State is only written from the interval callback, never synchronously.
  useEffect(() => {
    if (!undo) return;
    const t = window.setInterval(() => {
      setSecondsLeft(Math.max(0, Math.ceil((undo.expiresAt - Date.now()) / 1000)));
    }, 250);
    return () => window.clearInterval(t);
  }, [undo]);

  const clockNow = frozenAt ?? now;

  let defaultMinute = 1;
  if (match?.live_started_at) {
    const phase = livePhase(match.live_started_at, clockNow, settings);
    defaultMinute = Math.max(1, phase.minute || 1);
  }

  const teamPlayers = useMemo(
    () => allPlayers.filter((p) => p.teamId === activeTeamId),
    [allPlayers, activeTeamId]
  );

  const homeTeam: LiveFixtureTeam | null = fixture?.homeTeam
    ? { id: fixture.homeTeam.id, name: fixture.homeTeam.name, logo: fixture.homeTeam.logo_url ?? null }
    : null;
  const awayTeam: LiveFixtureTeam | null = fixture?.awayTeam
    ? { id: fixture.awayTeam.id, name: fixture.awayTeam.name, logo: fixture.awayTeam.logo_url ?? null }
    : null;

  const openPicker = (type: string) => {
    if (!activeTeamId) {
      toastError("Select a team first.");
      return;
    }
    setShowMore(false);
    setPickerType(type);
  };

  const onConfirm = async (payload: PickerConfirmPayload) => {
    if (!match || !activeTeamId || !pickerType) return;
    const type = pickerType;
    const minute = payload.minute;

    try {
      const goal = await logEvent.mutateAsync({
        fixtureId,
        playerId: payload.playerId,
        teamId: activeTeamId,
        type,
        minute,
        clientEventId: newClientEventId(),
      });
      const ids = [goal.id];

      // A goal may carry an assist — log it as its own event so the stat is
      // tracked, and let a single Undo remove both.
      if (type === "goal" && payload.assistPlayerId != null) {
        const assist = await logEvent.mutateAsync({
          fixtureId,
          playerId: payload.assistPlayerId,
          teamId: activeTeamId,
          type: "assist",
          minute,
          clientEventId: newClientEventId(),
        });
        ids.push(assist.id);
      }

      const playerName =
        allPlayers.find((p) => p.id === payload.playerId)?.name ?? "Player";
      setUndo({
        ids,
        message: `${eventTypeLabel(type)} added · ${playerName} ${minute}'`,
        expiresAt: Date.now() + UNDO_WINDOW_MS,
      });
      setSecondsLeft(Math.ceil(UNDO_WINDOW_MS / 1000));
      setAnnouncement(
        `${eventTypeLabel(type)} added, ${playerName}, ${minute} minutes. Undo available.`
      );
      setPickerType(null);
      success(`${eventTypeLabel(type)} logged.`);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Unable to save the event.");
    }
  };

  const onUndo = async () => {
    const current = undo;
    if (!current) return;
    setUndo(null);
    setAnnouncement("Event undone.");
    try {
      for (const id of current.ids) {
        await deleteEvent.mutateAsync(id);
      }
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Unable to undo.");
    }
  };

  const onRemove = async (event: { id?: number }) => {
    if (event.id == null) return;
    try {
      await deleteEvent.mutateAsync(event.id);
      success("Event removed.");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Unable to remove.");
    }
  };

  if (!Number.isFinite(fixtureId)) {
    return <EmptyState title="Match unavailable" description="Invalid fixture." />;
  }

  if (!canEdit) {
    return (
      <EmptyState
        title="Match Logger is for coaches"
        description="You do not have permission to log events for this match."
      />
    );
  }

  if (fixtureQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-[480px]">
        <LoadingState label="Loading match" />
      </div>
    );
  }

  if (fixtureQuery.isError || !match || !homeTeam || !awayTeam || homeTeamId == null || awayTeamId == null) {
    return (
      <EmptyState
        title="Match unavailable"
        description="This match could not be found."
      />
    );
  }

  const venueLine = [match.venue, `Round ${match.round}`].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto w-full max-w-[480px] px-4 pb-32 pt-4">
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push(`/org/${slug}/match-logger`)}
          aria-label="Back to live matches"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ml-surface-2)] text-[var(--ml-text)]"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-base leading-tight text-[var(--ml-text)] ${styles.display}`}>
            {competition?.name ?? "Match"}
          </p>
          {venueLine && (
            <p className="truncate text-xs text-[var(--ml-muted)]">{venueLine}</p>
          )}
        </div>
        <SyncChip state="live" />
        <LoggerSettings />
      </header>

      <div className="mt-3 space-y-3">
        <Scoreboard
          match={match}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          now={clockNow}
          settings={settings}
          paused={paused}
          onTogglePause={() => {
            if (paused) {
              setPaused(false);
              setFrozenAt(null);
            } else {
              setFrozenAt(Date.now());
              setPaused(true);
            }
          }}
        />

        <TeamToggle
          homeTeamId={homeTeamId}
          awayTeamId={awayTeamId}
          homeTeamName={homeTeam.name}
          awayTeamName={awayTeam.name}
          selectedTeamId={activeTeamId!}
          onSelect={setSelectedTeamId}
        />

        <EventKeypad
          onEvent={openPicker}
          onMore={() => setShowMore((v) => !v)}
          disabled={logEvent.isPending}
        />

        {showMore && (
          <div className="grid grid-cols-3 gap-2">
            {secondaryEventTypes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => openPicker(t)}
                className="rounded-xl bg-[var(--ml-surface-3)] px-2 py-3 text-xs font-semibold text-[var(--ml-text)]"
              >
                {eventTypeLabel(t)}
              </button>
            ))}
          </div>
        )}

        <Timeline
          events={match.events.filter((e) => isEventType(e.type))}
          players={allPlayers}
          homeTeamId={homeTeamId}
          awayTeamId={awayTeamId}
          homeTeamName={homeTeam.name}
          awayTeamName={awayTeam.name}
          onRemove={onRemove}
          disabled={deleteEvent.isPending}
        />
      </div>

      {undo && secondsLeft > 0 && (
        <UndoBar
          message={undo.message}
          secondsLeft={secondsLeft}
          onUndo={onUndo}
        />
      )}

      <PlayerPickerSheet
        key={pickerType ?? "closed"}
        open={pickerType != null}
        eventType={pickerType}
        teamName={activeTeamId === homeTeamId ? homeTeam.name : awayTeam.name}
        players={teamPlayers}
        defaultMinute={defaultMinute}
        submitting={logEvent.isPending}
        onClose={() => setPickerType(null)}
        onConfirm={onConfirm}
      />
    </div>
  );
}
