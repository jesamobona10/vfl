import { useQuery } from "@tanstack/react-query";
import type { LiveFixture } from "@/lib/types";

export interface LiveFixturesResponse {
  fixtures: LiveFixture[];
  liveCount: number;
  serverTime: string;
}

/**
 * Live match-logger feed for an organization.
 *
 * Polls on an interval as the baseline; Phase D layers Supabase Realtime on
 * top with this polling as the fallback. `enabled` lets callers skip the
 * request entirely (e.g. roles that cannot open the Match Logger).
 */
export function useLiveFixtures(
  slug: string | undefined,
  options: { enabled?: boolean } = {}
) {
  const enabled = Boolean(slug) && (options.enabled ?? true);

  return useQuery({
    queryKey: ["live-fixtures", slug],
    enabled,
    queryFn: async () => {
      const tz = new Date().getTimezoneOffset();
      const res = await fetch(`/api/org/${slug}/live-fixtures?tz=${tz}`);
      if (!res.ok) throw new Error("Failed to fetch live fixtures");
      return (await res.json()) as LiveFixturesResponse;
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
}
