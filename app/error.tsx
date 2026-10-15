"use client";

import { RouteError } from "@/components/shared/route-error";

export default function ErrorPage({
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
      route="app"
      title="Something went wrong"
      description="An unexpected error occurred while loading this page. Your data is safe — try again."
    />
  );
}
