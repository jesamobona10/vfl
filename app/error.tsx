"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-semibold text-text">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted">
        An unexpected error occurred while loading this page. Your data is safe — try again.
      </p>
      {error.digest && (
        <p className="text-xs text-muted/70">Error reference: {error.digest}</p>
      )}
      <button type="button" className="btn btn-primary btn-sm mt-2" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
