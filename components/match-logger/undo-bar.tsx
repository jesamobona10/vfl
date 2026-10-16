"use client";

import { cn } from "@/lib/utils";

/**
 * Floating confirmation bar shown after an event is logged (guide §4.3).
 * Gives the coach a short window to undo the write.
 */
export function UndoBar({
  message,
  secondsLeft,
  onUndo,
  offlineCount = 0,
}: {
  message: string;
  secondsLeft: number;
  onUndo: () => void;
  offlineCount?: number;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[max(16px,env(safe-area-inset-bottom))] z-40 flex justify-center px-4"
    >
      <div className="pointer-events-auto flex w-full max-w-[480px] items-center gap-3 rounded-2xl bg-[var(--ml-surface-2)] px-4 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.55)]">
        <span className="min-w-0 flex-1 truncate text-sm text-[var(--ml-text)]">
          {message}
        </span>
        {offlineCount > 0 && (
          <span className="shrink-0 text-xs text-[var(--ml-gold)]">
            {offlineCount} queued
          </span>
        )}
        <button
          type="button"
          onClick={onUndo}
          className={cn(
            "shrink-0 rounded-xl px-3 py-2 text-sm font-bold text-[#1A1405]",
            "bg-[var(--ml-gold)] active:opacity-80"
          )}
        >
          Undo · {Math.max(0, secondsLeft)}s
        </button>
      </div>
    </div>
  );
}
