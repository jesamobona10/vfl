"use client";

import { cn } from "@/lib/utils";

export type SyncState = "live" | "synced" | "stale" | "offline";

const STATE_STYLES: Record<SyncState, { dot: string; label: string; text: string }> = {
  live: { dot: "bg-live-500 animate-pulse", label: "Live", text: "text-live-500" },
  synced: { dot: "bg-live-500", label: "Synced", text: "text-ink-2" },
  stale: { dot: "bg-warn-500", label: "Syncing…", text: "text-warn-500" },
  offline: { dot: "bg-danger-500", label: "Offline", text: "text-danger-500" },
};

/**
 * Small connectivity/status chip for the match-logger header and cards.
 *
 * Phase A renders `live`/`synced`/`stale`. The `offline` state and the queued
 * count are wired up when the offline write queue lands (Phase D).
 */
export function SyncChip({
  state = "synced",
  queued = 0,
  className,
}: {
  state?: SyncState;
  queued?: number;
  className?: string;
}) {
  const styles = STATE_STYLES[state];
  const label =
    state === "offline" && queued > 0 ? `Offline · ${queued} queued` : styles.label;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        styles.text,
        className
      )}
      role="status"
      aria-live="polite"
    >
      <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", styles.dot)} />
      {label}
    </span>
  );
}
