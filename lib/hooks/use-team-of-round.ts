import { useQuery } from "@tanstack/react-query";
import type { TeamOfRoundResult } from "@/lib/types";
import { fetchJson } from "@/lib/utils/fetch";

/** Load the Team of the Round for a competition season and optional round. */
export function useTeamOfRound(
  competitionId: string | undefined,
  seasonId: string | undefined,
  round?: number
) {
  return useQuery({
    queryKey: ["team-of-round", competitionId, seasonId, round ?? "latest"],
    queryFn: () => {
      const params = new URLSearchParams();
      if (seasonId) params.set("seasonId", seasonId);
      if (round != null) params.set("round", String(round));
      return fetchJson<TeamOfRoundResult>(
        `/api/competitions/${competitionId}/team-of-round?${params.toString()}`
      );
    },
    enabled: !!competitionId && !!seasonId,
    staleTime: 60_000,
  });
}
