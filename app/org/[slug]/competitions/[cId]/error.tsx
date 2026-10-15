"use client";

import { RouteError } from "@/components/shared/route-error";

export default function CompetitionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      error={error}
      reset={reset}
      route="competition"
      title="Couldn't load this competition"
      description="The competition may have been deleted, archived, or moved to another season. Check the competition list, then try again."
      secondary={{ label: "All competitions", href: "/admin" }}
    />
  );
}
