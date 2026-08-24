"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function OrgError({
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
      <h1 className="text-xl font-semibold text-text">Couldn&apos;t load this organization</h1>
      <p className="max-w-md text-sm text-muted">
        The organization may have been renamed, archived, or you may no longer have access to it.
        If you were invited recently, ask an organization owner to re-check your membership.
      </p>
      {error.digest && <p className="text-xs text-muted/70">Error reference: {error.digest}</p>}
      <div className="mt-2 flex gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={reset}>
          Try again
        </button>
        <Link href="/" className="btn btn-secondary btn-sm">
          Back to home
        </Link>
      </div>
    </div>
  );
}
