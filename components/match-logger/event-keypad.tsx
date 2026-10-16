"use client";

import { Flag } from "lucide-react";
import { TactileKey } from "./tactile-key";
import styles from "./match-logger.module.css";

/**
 * The primary action keypad (guide §4.3). Emits the event type to log; MORE
 * opens the full picker. Scoring keys use the goal/gold edges; the card keys
 * use their discipline colours.
 */
export function EventKeypad({
  onEvent,
  onMore,
  disabled,
}: {
  onEvent: (type: string) => void;
  onMore: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2.5">
      <TactileKey
        onClick={() => onEvent("goal")}
        disabled={disabled}
        edge="#074D2B"
        ariaLabel="Log goal"
        className="w-full text-[color:#EAF4EC]"
        style={{
          height: 84,
          background: "linear-gradient(180deg, var(--ml-green-hi), var(--ml-green))",
        }}
      >
        <Flag size={30} strokeWidth={2.5} aria-hidden />
        <span
          className={styles.display}
          style={{ fontSize: 34, letterSpacing: "0.1em" }}
        >
          GOAL
        </span>
      </TactileKey>

      <div className="grid grid-cols-3 gap-2.5">
        <TactileKey
          onClick={() => onEvent("assist")}
          disabled={disabled}
          edge="#0A1710"
          className="h-[68px] bg-[var(--ml-surface-2)] text-sm text-[var(--ml-text)]"
        >
          ASSIST
        </TactileKey>
        <TactileKey
          onClick={() => onEvent("yellow")}
          disabled={disabled}
          edge="#8A6C0C"
          className="h-[68px] flex-col gap-1 bg-[var(--ml-surface-2)] text-sm text-[var(--ml-text)]"
        >
          <span
            aria-hidden
            className="h-3.5 w-2.5 rounded-[2px] bg-[var(--ml-yellow)]"
          />
          YELLOW
        </TactileKey>
        <TactileKey
          onClick={() => onEvent("red")}
          disabled={disabled}
          edge="#7E1F1F"
          className="h-[68px] flex-col gap-1 bg-[var(--ml-surface-2)] text-sm text-[var(--ml-text)]"
        >
          <span aria-hidden className="h-3.5 w-2.5 rounded-[2px] bg-[var(--ml-red)]" />
          RED
        </TactileKey>
      </div>

      <div className="grid grid-cols-[1.5fr_1fr] gap-2.5">
        <TactileKey
          onClick={() => onEvent("own-goal")}
          disabled={disabled}
          edge="#0A1710"
          className="h-[60px] bg-[var(--ml-surface-2)] text-sm text-[var(--ml-text)]"
        >
          OWN GOAL
        </TactileKey>
        <TactileKey
          onClick={onMore}
          disabled={disabled}
          edge="#0A1710"
          className="h-[60px] bg-[var(--ml-surface-3)] text-sm text-[var(--ml-muted)]"
        >
          MORE
        </TactileKey>
      </div>
    </div>
  );
}
