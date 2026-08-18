"use client";

import type { Match } from "@/lib/types";
import { useLiveClock } from "./live-clock";
import type { LiveClockSettings } from "@/lib/logic/live";

interface LiveBadgeProps {
  match: Match;
  settings?: LiveClockSettings;
}

export function LiveBadge({ match, settings }: LiveBadgeProps) {
  const phase = useLiveClock(match.live_started_at, settings);
  const isHalfTime = phase?.label === "HT";
  const isFullTime = phase?.label === "FT";

  if (isFullTime) return null;

  const active = isHalfTime
    ? {
        ring: "border-danger/30 bg-danger/15 text-danger",
        dot: "bg-danger",
        label: "Half-time",
      }
    : {
        ring: "border-live-500/30 bg-live-tint text-live-500",
        dot: "bg-live-500",
        label: "Live",
      };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-bold uppercase tracking-wide animate-pulse ${active.ring}`}
    >
      <span className="relative flex h-2 w-2">
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${active.dot}`}
        />
        <span className={`relative inline-flex h-2 w-2 rounded-full ${active.dot}`} />
      </span>
      {active.label}
    </span>
  );
}
