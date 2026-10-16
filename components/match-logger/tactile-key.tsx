"use client";

import type { CSSProperties, ReactNode } from "react";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { feedback, type HapticKind } from "@/lib/match-logger/haptics";
import styles from "./match-logger.module.css";

export interface TactileKeyProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** Colour of the key's bottom edge (the `--edge` custom property). */
  edge?: string;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  ariaPressed?: boolean;
  /** Haptic pattern fired on press. Defaults to a light tap. */
  hapticKind?: HapticKind;
  /** Ignore further presses for this long (ms) to swallow double taps. */
  lockMs?: number;
}

/**
 * The base pressable key for the Match Logger. Fires press feedback and locks
 * out rapid repeat presses; the visual depth comes from `.key` in the module.
 */
export function TactileKey({
  children,
  onClick,
  disabled,
  edge = "#0a1710",
  className,
  style,
  ariaLabel,
  ariaPressed,
  hapticKind = "tap",
  lockMs = 400,
}: TactileKeyProps) {
  const lastPress = useRef(0);

  const handleClick = () => {
    const now = Date.now();
    if (now - lastPress.current < lockMs) return;
    lastPress.current = now;
    feedback(hapticKind);
    onClick?.();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      className={cn(styles.key, "rounded-2xl px-4 font-semibold", className)}
      style={{ "--edge": edge, ...style } as CSSProperties}
    >
      {children}
    </button>
  );
}
