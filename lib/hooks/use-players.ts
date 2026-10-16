import { useQuery } from "@tanstack/react-query";
import type { Player } from "@/lib/types";

/**
 * Players for the current organization, optionally scoped further.
 * `orgId` is passed through to the API; without it the API falls back to the
 * caller's own organization.
 */
export function usePlayers(orgId?: string | null) {
  return useQuery({
    queryKey: ["players", orgId ?? null],
    queryFn: () => {
      const qs = orgId ? `?org_id=${encodeURIComponent(orgId)}` : "";
      return fetch(`/api/players${qs}`).then((res) => {
        if (!res.ok) throw new Error("Failed to fetch players");
        return res.json() as Promise<{ players: Player[] }>;
      });
    },
  });
}
