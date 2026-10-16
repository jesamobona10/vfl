"use client";

import { Settings } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  feedback,
  getCanVibrateSnapshot,
  getClickSnapshot,
  getHapticsSnapshot,
  setClickEnabled,
  setHapticsEnabled,
  subscribePrefs,
} from "@/lib/match-logger/haptics";
import { cn } from "@/lib/utils";

const subscribeCanVibrate = () => () => {};

function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left",
        disabled ? "opacity-50" : "hover:bg-[var(--ml-surface-2)]"
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[var(--ml-text)]">{label}</span>
        {hint && <span className="block text-[11px] text-[var(--ml-muted)]">{hint}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-[var(--ml-green-hi)]" : "bg-[var(--ml-surface-2)]"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
            checked ? "left-[22px]" : "left-0.5"
          )}
        />
      </span>
    </button>
  );
}

/**
 * Small settings popover for the logger: haptics and the iOS click-sound
 * fallback (guide §5). Preferences persist in localStorage.
 */
export function LoggerSettings() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const haptics = useSyncExternalStore(
    subscribePrefs,
    getHapticsSnapshot,
    getHapticsSnapshot
  );
  const click = useSyncExternalStore(
    subscribePrefs,
    getClickSnapshot,
    getClickSnapshot
  );
  const canVibrate = useSyncExternalStore(
    subscribeCanVibrate,
    getCanVibrateSnapshot,
    getCanVibrateSnapshot
  );

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          feedback("tap");
          setOpen((v) => !v);
        }}
        aria-label="Logger settings"
        aria-haspopup="true"
        aria-expanded={open}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ml-surface-2)] text-[var(--ml-text)]"
      >
        <Settings size={18} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-[var(--ml-line)] bg-[var(--ml-surface)] p-2 shadow-[0_18px_40px_rgba(0,0,0,0.55)]"
        >
          <ToggleRow
            label="Haptics"
            hint={canVibrate ? "Vibrate on press" : "Not supported on this device"}
            checked={haptics}
            disabled={!canVibrate}
            onChange={(next) => {
              setHapticsEnabled(next);
              if (next) feedback("select");
            }}
          />
          <ToggleRow
            label="Click sound"
            hint="Fallback feedback for iPhone"
            checked={click}
            onChange={(next) => {
              setClickEnabled(next);
              if (next) feedback("select");
            }}
          />
        </div>
      )}
    </div>
  );
}
