import { useQuery } from "@tanstack/react-query";
import type { Player } from "@/lib/types";

export function usePlayers() {
  return useQuery({
    queryKey: ["players"],
    queryFn: () =>
      fetch("/api/players").then((res) => {
        if (!res.ok) throw new Error("Failed to fetch players");
        return res.json() as Promise<{ players: Player[] }>;
      }),
  });
}
