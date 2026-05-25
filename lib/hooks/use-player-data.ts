import { useCallback, useState } from "react";

export interface PlayerData {
  player: {
    id: number;
    teamId: number;
    name: string;
    position: string;
    number: number;
    photoUrl: string | null;
    goals: number;
    assists: number;
    ownGoals: number;
    yellowCards: number;
    redCards: number;
    saves: number;
    penaltySaves: number;
    cleanSheets: number;
    motm: number;
    tackles: number;
    interceptions: number;
    blocks: number;
    aerialDuelsWon: number;
    errorsLeadingToGoal: number;
    penaltiesConceded: number;
    goalsConceded: number;
    matchWins: number;
    bonus5Saves: number;
    captain: boolean;
    rating: number;
    matchRatings: Record<string, number>;
  };
  team: { name: string; logo: string | null; rating: number } | null;
  teamFixtures: any[];
  allFixtures: any[];
  matchEvents: any[];
  allPlayers: any[];
  standings: { id: number; name: string; logo: string | null; goals: number; wins: number; rating: number }[];
}

export function usePlayerData() {
  const [data, setData] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/player/data");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Failed to load player data.");
        return;
      }
      const json = await res.json();
      setData(json);
    } catch {
      setError("Failed to load player data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, refresh };
}
