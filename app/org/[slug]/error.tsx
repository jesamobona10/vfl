"use client";

import { RouteError } from "@/components/shared/route-error";

export default function OrgError({
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
      route="org"
      title="Couldn't load this organization"
      description="The organization may have been renamed, archived, or you may no longer have access to it. If you were invited recently, ask an organization owner to re-check your membership."
      secondary={{ label: "Back to home", href: "/" }}
    />
  );
}
