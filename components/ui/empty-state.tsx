import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  /** Optional icon shown above the title. */
  icon?: LucideIcon;
  /** Short, action-oriented heading, e.g. "No fixtures yet". */
  title: string;
  /** Supporting copy explaining what to do next. */
  description?: React.ReactNode;
  /** Primary call to action (a `Button`/`Link`). */
  action?: React.ReactNode;
  /** Optional secondary, lower-emphasis action. */
  secondaryAction?: React.ReactNode;
  /** `sm` for inline widgets (dashboard cards); `md` for full-page panels. */
  size?: "sm" | "md";
  className?: string;
}

/**
 * The single empty state used across list and data screens.
 *
 * Pair it with a skeleton while loading and an error state with retry on
 * failure so every data screen tells the same story.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  size = "md",
  className,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        size === "sm" ? "px-4 py-6" : "px-6 py-10",
        className
      )}
    >
      {Icon && (
        <Icon
          size={size === "sm" ? 32 : 48}
          aria-hidden="true"
          className={cn("text-ink-3/40", size === "sm" ? "mb-2" : "mb-4")}
        />
      )}
      <p className={cn("font-semibold text-text", size === "sm" ? "text-sm" : "text-base")}>
        {title}
      </p>
      {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      {(action || secondaryAction) && (
        <div
          className={cn(
            "flex flex-wrap items-center justify-center gap-2",
            size === "sm" ? "mt-3" : "mt-5"
          )}
        >
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
