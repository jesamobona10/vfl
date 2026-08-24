"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function CompetitionError({
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
      <h1 className="text-xl font-semibold text-text">Couldn&apos;t load this competition</h1>
      <p className="max-w-md text-sm text-muted">
        The competition may have been deleted, archived, or moved to another season. Check the
        competition list, then try again.
      </p>
      {error.digest && <p className="text-xs text-muted/70">Error reference: {error.digest}</p>}
      <div className="mt-2 flex gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={reset}>
          Try again
        </button>
        <Link href="/admin" className="btn btn-secondary btn-sm">
          All competitions
        </Link>
      </div>
    </div>
  );
}
