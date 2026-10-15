import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface ErrorStateProps {
  /** Short heading, e.g. "Couldn't load players". */
  title?: string;
  /** The reason, usually the server-provided message. */
  description?: React.ReactNode;
  /** When provided, renders a "Try again" button that calls this. */
  onRetry?: () => void;
  /** Override the retry button label. */
  retryLabel?: string;
  /** `sm` for inline widgets; `md` for full-page panels. */
  size?: "sm" | "md";
  className?: string;
}

/**
 * Inline error state for a data screen, optionally with retry.
 *
 * Use within a `panel`/`card` so a failed list still shows chrome (title,
 * filters) rather than a blank page.
 */
export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  retryLabel = "Try again",
  size = "md",
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        size === "sm" ? "px-4 py-6" : "px-6 py-10",
        className
      )}
    >
      <AlertCircle
        size={size === "sm" ? 32 : 40}
        aria-hidden="true"
        className={cn("text-danger/70", size === "sm" ? "mb-2" : "mb-4")}
      />
      <p className={cn("font-semibold text-text", size === "sm" ? "text-sm" : "text-base")}>
        {title}
      </p>
      {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
