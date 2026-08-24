import { cn } from "@/lib/utils";

/**
 * Shared inline error banner. Renders nothing when message is empty.
 */
export function ErrorBanner({
  message,
  className,
  id,
  onDismiss,
}: {
  message?: string | null;
  className?: string;
  id?: string;
  onDismiss?: () => void;
}) {
  if (!message) return null;
  return (
    <div
      role="alert"
      id={id}
      className={cn(
        "flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-4 py-3",
        className
      )}
    >
      <span aria-hidden="true" className="font-bold">
        !
      </span>
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="ml-auto shrink-0 rounded p-0.5 transition-colors hover:bg-danger/10"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
