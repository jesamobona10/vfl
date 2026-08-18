import { useQuery } from "@tanstack/react-query";
import type { Team } from "@/lib/types";

export function useTeams() {
  return useQuery({
    queryKey: ["teams"],
    queryFn: () =>
      fetch("/api/teams").then((res) => {
        if (!res.ok) throw new Error("Failed to fetch teams");
        return res.json() as Promise<{ teams: Team[] }>;
      }),
  });
}

export function useTeam(id: number | undefined) {
  return useQuery({
    queryKey: ["team", id],
    queryFn: () =>
      fetch(`/api/teams/${id}`).then((res) => {
        if (!res.ok) throw new Error("Failed to fetch team");
        return res.json() as Promise<{ team: Team }>;
      }),
    enabled: !!id,
  });
}
