"use client";

import { Pause, Play } from "lucide-react";
import type { LiveFixtureTeam, Match } from "@/lib/types";
import { formatLiveClock, livePhase, type LiveClockSettings } from "@/lib/logic/live";
import { cn } from "@/lib/utils";
import styles from "./match-logger.module.css";

const PHASE_LABEL: Record<string, string> = {
  "1H": "1ST HALF",
  HT: "HALF TIME",
  "2H": "2ND HALF",
  FT: "FULL TIME",
};

function Crest({ team }: { team: LiveFixtureTeam }) {
  if (team.logo) {
    return (
      <img
        src={team.logo}
        alt=""
        width={48}
        height={48}
        loading="lazy"
        decoding="async"
        className="h-12 w-12 shrink-0 rounded-full object-cover"
      />
    );
  }
  const initials = team.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--ml-surface-2)] text-sm font-semibold text-[var(--ml-muted)]"
    >
      {initials || "?"}
    </span>
  );
}

/** The match-logger scoreboard (guide §4.3). */
export function Scoreboard({
  match,
  homeTeam,
  awayTeam,
  now,
  settings,
  paused,
  onTogglePause,
}: {
  match: Match;
  homeTeam: LiveFixtureTeam;
  awayTeam: LiveFixtureTeam;
  /** Current time in ms; frozen by the parent while "paused". */
  now: number;
  settings?: Required<LiveClockSettings>;
  paused: boolean;
  onTogglePause: () => void;
}) {
  const phase = match.live_started_at
    ? livePhase(match.live_started_at, now, settings)
    : null;
  const started = Boolean(match.live_started_at);
  const clock = phase ? formatLiveClock(phase) : "—";

  return (
    <div
      className="rounded-3xl p-4"
      style={{
        background: "linear-gradient(180deg, #14301F 0%, #0E1D14 100%)",
        border: "1px solid var(--ml-line)",
      }}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex flex-col items-center gap-2 text-center">
          <Crest team={homeTeam} />
          <span className="line-clamp-2 text-xs font-semibold text-[var(--ml-text)]">
            {homeTeam.name}
          </span>
        </div>
        <div className={cn("flex items-center gap-2 text-[var(--ml-text)]", styles.display)}>
          <span className="text-5xl leading-none">{match.homeScore ?? 0}</span>
          <span className="text-3xl leading-none text-[var(--ml-muted)]">–</span>
          <span className="text-5xl leading-none">{match.awayScore ?? 0}</span>
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <Crest team={awayTeam} />
          <span className="line-clamp-2 text-xs font-semibold text-[var(--ml-text)]">
            {awayTeam.name}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "h-2 w-2 rounded-full bg-[var(--ml-live)]",
            started && !phase?.done && styles.pulse
          )}
        />
        <span className={cn("text-2xl leading-none text-[var(--ml-gold)]", styles.display)}>
          {clock}
        </span>
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ml-muted)]">
          {phase ? PHASE_LABEL[phase.label] : "NOT STARTED"}
        </span>
        <button
          type="button"
          onClick={onTogglePause}
          disabled={!started || phase?.done}
          aria-label={paused ? "Resume clock" : "Pause clock"}
          className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ml-surface-2)] text-[var(--ml-text)] disabled:opacity-40"
        >
          {paused ? <Play size={15} /> : <Pause size={15} />}
        </button>
      </div>
      {paused && (
        <p className="mt-1 text-center text-[11px] text-[var(--ml-muted)]">
          Clock paused on this device
        </p>
      )}
    </div>
  );
}
