"use client";

import { useEffect } from "react";
import Link from "next/link";
import { captureError } from "@/lib/monitoring";

/**
 * Shared body for App Router `error.tsx` boundaries. Reports the error to
 * monitoring (a no-op without a DSN) and renders a consistent, accessible
 * fallback with a retry action.
 */
export function RouteError({
  error,
  reset,
  route,
  title,
  description,
  secondary,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** Logical route name used to tag the error report. */
  route: string;
  title: string;
  description: string;
  secondary?: { label: string; href: string };
}) {
  useEffect(() => {
    console.error(error);
    void captureError(error, { route });
  }, [error, route]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-semibold text-text">{title}</h1>
      <p className="max-w-md text-sm text-muted">{description}</p>
      {error.digest && <p className="text-xs text-muted/70">Error reference: {error.digest}</p>}
      <div className="mt-2 flex gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={reset}>
          Try again
        </button>
        {secondary && (
          <Link href={secondary.href} className="btn btn-secondary btn-sm">
            {secondary.label}
          </Link>
        )}
      </div>
    </div>
  );
}
