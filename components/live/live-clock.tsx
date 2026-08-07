"use client";

import { useEffect, useMemo, useState } from "react";
import type { Match } from "@/lib/types";
import {
  livePhase,
  liveSettings,
  type LiveClockSettings,
} from "@/lib/logic/live";

export function useLiveClock(
  startedAt: string | null | undefined,
  settings?: LiveClockSettings
) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const phase = useMemo(() => {
    if (!startedAt) return null;
    return livePhase(startedAt, now, liveSettings(settings));
  }, [startedAt, now, settings]);

  return phase;
}

interface LiveClockProps {
  match: Match;
  settings?: LiveClockSettings;
}

export function LiveClock({ match, settings }: LiveClockProps) {
  const phase = useLiveClock(match.live_started_at, settings);
  if (!phase) return null;

  const tone = {
    "1H": "bg-live-tint text-live-500",
    HT: "bg-warn-500/20 text-warn-500",
    "2H": "bg-live-tint text-live-500",
    FT: "bg-brand-50 text-brand-700",
  }[phase.label];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums ${tone}`}>
      <span className="relative flex h-1.5 w-1.5">
        {phase.label !== "HT" && phase.label !== "FT" && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live-500 opacity-75" />
        )}
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
      </span>
      {phase.label === "HT"
        ? "Half-time"
        : phase.label === "FT"
        ? "Full Time"
        : `${phase.minute}${phase.stoppage ? ` ${phase.stoppage}` : ""}'`}
    </span>
  );
}
