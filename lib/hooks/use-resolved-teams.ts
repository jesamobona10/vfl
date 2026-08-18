import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { useSeasonTeams } from "@/lib/hooks/use-competitions";
import type { Team } from "@/lib/types";

/**
 * Resolves the active list of teams, preferring season-scoped teams
 * when a `seasonId` is provided, otherwise falling back to the global
 * store's team list.
 *
 * This hook eliminates the duplicated pattern:
 * ```ts
 * const teams = (seasonTeamsRaw || useAppStore.getState().teams).map((st: any) => st.team || st);
 * ```
 * that was previously copy-pasted into 15+ components.
 *
 * @param seasonId - Optional season ID to fetch season-scoped teams for.
 * @returns A memoized array of {@link Team} objects.
 */
export function useResolvedTeams(seasonId?: string | null): Team[] {
  const { data: seasonTeamsRaw } = useSeasonTeams(seasonId ?? undefined);
  const fallbackTeams = useAppStore((s) => s.teams);

  return useMemo(() => {
    if (seasonTeamsRaw && seasonTeamsRaw.length > 0) {
      return seasonTeamsRaw.map((st) => {
        const team = st.team;
        if (team) {
          return {
            id: team.id,
            name: team.name,
            logo_url: team.logo_url ?? undefined,
            rating: team.rating ?? 6.0,
          };
        }
        return st as unknown as Team;
      });
    }
    return fallbackTeams;
  }, [seasonTeamsRaw, fallbackTeams]);
}
