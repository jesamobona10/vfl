import type { Match } from "../types";

export interface LiveClockSettings {
  /** Length of the halftime break in minutes (default 15). */
  halftimeMinutes?: number;
  /** Automatic stoppage time added at the end of each half in minutes (default 3). */
  stoppageMinutes?: number;
}

export interface LivePhase {
  label: "1H" | "HT" | "2H" | "FT";
  /** Displayed match minute (45 during first-half stoppage, 90 during second-half stoppage). */
  minute: number;
  /** Stoppage indicator like "+3" when the clock is in added time, otherwise "". */
  stoppage: string;
  /** Seconds within the current displayed minute (0-59). */
  seconds: number;
  /** Full elapsed real time since kickoff in ms. */
  elapsedMs: number;
  /** True when the second half (including stoppage) has ended. */
  done: boolean;
}

export const DEFAULT_LIVE_SETTINGS: Required<LiveClockSettings> = {
  halftimeMinutes: 15,
  stoppageMinutes: 3,
};

const MIN_MS = 60_000;

function minutesSetting(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function liveSettings(competitionSettings?: LiveClockSettings | Record<string, unknown>): Required<LiveClockSettings> {
  const raw = (competitionSettings || {}) as Record<string, unknown>;
  return {
    halftimeMinutes: minutesSetting(raw.halftimeMinutes, DEFAULT_LIVE_SETTINGS.halftimeMinutes),
    stoppageMinutes: minutesSetting(raw.stoppageMinutes, DEFAULT_LIVE_SETTINGS.stoppageMinutes),
  };
}

/**
 * Compute the live clock phase for a match that has started.
 * The clock counts up from kickoff (`live_started_at`) and runs in real time.
 *
 * Timeline:
 *   1H   : 0 -> (45 + stoppage) minutes
 *   HT   : fixed halftime break
 *   2H   : resumes at 45' -> (90 + stoppage)
 *   FT   : done
 */
export function livePhase(
  startedAt: string | Date,
  now: Date | number,
  settings: Required<LiveClockSettings> = DEFAULT_LIVE_SETTINGS
): LivePhase {
  const kickoff = new Date(startedAt).getTime();
  const current = now instanceof Date ? now.getTime() : now;
  const elapsedMs = Math.max(0, current - kickoff);

  const halfMs = 45 * MIN_MS;
  const firstHalfMs = halfMs + settings.stoppageMinutes * MIN_MS;
  const halftimeStart = firstHalfMs;
  const secondHalfStart = halftimeStart + settings.halftimeMinutes * MIN_MS;
  const secondHalfMs = halfMs + settings.stoppageMinutes * MIN_MS;
  const fullTimeMs = secondHalfStart + secondHalfMs;

  if (elapsedMs < halftimeStart) {
    // First half, including stoppage window after regulation 45'.
    const inStoppage = elapsedMs >= halfMs;
    const stoppageSecond = inStoppage
      ? Math.min(
          Math.floor((elapsedMs - halfMs) / MIN_MS),
          settings.stoppageMinutes - 1
        )
      : 0;
    return {
      label: "1H",
      minute: inStoppage ? 45 : Math.min(45, Math.floor(elapsedMs / MIN_MS)),
      stoppage: inStoppage ? `+${stoppageSecond + 1}` : "",
      seconds: Math.floor((elapsedMs % MIN_MS) / 1000),
      elapsedMs,
      done: false,
    };
  }

  if (elapsedMs < secondHalfStart) {
    return { label: "HT", minute: 45, stoppage: "", seconds: 0, elapsedMs, done: false };
  }

  if (elapsedMs < fullTimeMs) {
    const playElapsed = elapsedMs - secondHalfStart;
    const inStoppage = playElapsed >= halfMs;
    const stoppageSecond = inStoppage
      ? Math.min(
          Math.floor((playElapsed - halfMs) / MIN_MS),
          settings.stoppageMinutes - 1
        )
      : 0;
    const playedMinute = 45 + Math.min(45, Math.floor(playElapsed / MIN_MS));
    return {
      label: "2H",
      minute: inStoppage ? 90 : playedMinute,
      stoppage: inStoppage ? `+${stoppageSecond + 1}` : "",
      seconds: Math.floor((playElapsed % MIN_MS) / 1000),
      elapsedMs,
      done: false,
    };
  }

  return { label: "FT", minute: 90, stoppage: `+${settings.stoppageMinutes}`, seconds: 0, elapsedMs, done: true };
}

/** Format a phase as a clock string, e.g. "45+3'" or "12:34". */
export function formatLiveClock(phase: LivePhase): string {
  if (phase.label === "HT") return "HT";
  if (phase.stoppage) return `${phase.minute}${phase.stoppage}'`;
  if (phase.minute === 0) return `${phase.minute}:${String(phase.seconds).padStart(2, "0")}`;
  return `${phase.minute}:${String(phase.seconds).padStart(2, "0")}`;
}

function parseTimeToMinutes(time: string): number | null {
  if (!time) return null;
  const trimmed = time.trim().toUpperCase();
  const apMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (apMatch) {
    let h = Number(apMatch[1]);
    const m = Number(apMatch[2] || 0);
    if (apMatch[3] === "PM" && h !== 12) h += 12;
    if (apMatch[3] === "AM" && h === 12) h = 0;
    return h * 60 + m;
  }
  const h24Match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (h24Match) return Number(h24Match[1]) * 60 + Number(h24Match[2]);
  return null;
}

/** Scheduled kickoff as a Date from match date + time, or null when unset. */
export function matchKickoff(match: { date?: string; time?: string }): Date | null {
  if (!match.date || !match.time) return null;
  const mins = parseTimeToMinutes(match.time);
  if (mins === null) return null;
  const d = new Date(`${match.date}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  d.setMinutes(mins);
  return d;
}

/**
 * True when a scheduled match should surface in the Live Event tab:
 * its kickoff has arrived and it is still within the grace window.
 * Matches that are already live/in-progress are always eligible.
 */
export function isLiveEligible(
  match: Match,
  now: Date | number,
  graceMinutes = 10
): boolean {
  if (match.status === "live" || match.status === "in-progress") return true;
  if (match.status !== "scheduled") return false;
  const kickoff = matchKickoff(match);
  if (!kickoff) return false;
  const current = now instanceof Date ? now.getTime() : now;
  const kickoffMs = kickoff.getTime();
  return current >= kickoffMs && current <= kickoffMs + graceMinutes * MIN_MS;
}
