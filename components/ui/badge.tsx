import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "neutral"
  | "brand"
  | "live"
  | "danger"
  | "warn"
  | "upcoming"
  | "finished"
  | "cancelled";

export type BadgeSize = "sm" | "md";

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  neutral: "bg-muted/15 text-ink-2",
  brand: "bg-brand-50 text-brand-700",
  live: "bg-live-tint text-live-500",
  danger: "bg-danger-tint text-danger-500",
  warn: "bg-warn-tint text-warn-500",
  upcoming: "bg-upcoming-tint text-upcoming-500",
  finished: "bg-finished-tint text-finished-500",
  cancelled: "bg-cancelled-tint text-cancelled-500",
};

const SIZE_STYLES: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-[11px] gap-1",
  md: "px-2.5 py-1 text-xs gap-1.5",
};

const DOT_STYLES: Record<BadgeVariant, string> = {
  neutral: "bg-ink-3",
  brand: "bg-brand-600",
  live: "bg-live-500",
  danger: "bg-danger-500",
  warn: "bg-warn-500",
  upcoming: "bg-upcoming-500",
  finished: "bg-finished-500",
  cancelled: "bg-cancelled-500",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Render a leading status dot. */
  dot?: boolean;
  /** Pulse the dot (e.g. a live match). */
  pulse?: boolean;
}

export function Badge({
  variant = "neutral",
  size = "sm",
  dot = false,
  pulse = false,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold whitespace-nowrap",
        VARIANT_STYLES[variant],
        SIZE_STYLES[size],
        className
      )}
      {...rest}
    >
      {dot && (
        <span
          aria-hidden
          className={cn(
            "inline-block h-[5px] w-[5px] shrink-0 rounded-full",
            DOT_STYLES[variant],
            pulse && "animate-pulse"
          )}
        />
      )}
      {children}
    </span>
  );
}
