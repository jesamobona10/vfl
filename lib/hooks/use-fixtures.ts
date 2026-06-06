import { useQuery } from "@tanstack/react-query";
import type { FixtureRound } from "@/lib/types";

export function useFixtures() {
  return useQuery({
    queryKey: ["fixtures"],
    queryFn: () =>
      fetch("/api/fixtures").then((res) => {
        if (!res.ok) throw new Error("Failed to fetch fixtures");
        return res.json() as Promise<{ fixtures: FixtureRound[] }>;
      }),
  });
}
