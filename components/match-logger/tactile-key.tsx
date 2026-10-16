"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
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
}

/**
 * The base pressable key for the Match Logger. Visual feedback only here;
 * the haptic call and press-lock live in Phase C.
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
}: TactileKeyProps) {
  return (
    <button
      type="button"
      onClick={onClick}
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
