import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/lib/utils/fetch";

export interface SeasonFixtureStats {
  total: number;
  scheduled: number;
  inProgress: number;
  completed: number;
  liveCount: number;
}

export interface SeasonTeamStats {
  total: number;
  active: number;
}

export interface CompetitionOverviewStats {
  teams: SeasonTeamStats;
  fixtures: SeasonFixtureStats;
  players: { total: number };
  lastUpdated: string | null;
  hasLiveMatches: boolean;
}

/**
 * Hook to fetch fixture stats for a specific season
 */
export function useSeasonFixtureStats(seasonId: string | undefined) {
  return useQuery({
    queryKey: ["season-fixture-stats", seasonId],
    queryFn: async () => {
      if (!seasonId) return null;
      const res = await fetch(`/api/seasons/${seasonId}/fixtures`);
      if (!res.ok) throw new Error("Failed to fetch fixtures");
      const data = await res.json();
      const fixtures = data.fixtures || [];

      const total = fixtures.length;
      const scheduled = fixtures.filter((f: any) => f.status === "scheduled").length;
      const inProgress = fixtures.filter((f: any) => f.status === "in-progress" || f.status === "live").length;
      const completed = fixtures.filter((f: any) => f.status === "completed").length;
      const liveCount = fixtures.filter((f: any) => f.status === "live").length;

      return {
        total,
        scheduled,
        inProgress,
        completed,
        liveCount,
      };
    },
    enabled: !!seasonId,
    staleTime: 30_000,
    refetchInterval: (query) => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        return 30_000;
      }
      return false;
    },
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook to fetch season team stats
 */
export function useSeasonTeamStats(seasonId: string | undefined) {
  return useQuery({
    queryKey: ["season-team-stats", seasonId],
    queryFn: async () => {
      if (!seasonId) return null;
      const res = await fetch(`/api/seasons/${seasonId}/teams`);
      if (!res.ok) throw new Error("Failed to fetch teams");
      const data = await res.json();
      const teams = data.teams || [];

      const total = teams.length;
      const active = teams.filter((t: any) => t.status === "active").length;

      return {
        total,
        active,
      };
    },
    enabled: !!seasonId,
    staleTime: 60_000,
  });
}

/**
 * Hook to fetch player count for a season
 */
export function useSeasonPlayerCount(seasonId: string | undefined) {
  return useQuery({
    queryKey: ["season-player-count", seasonId],
    queryFn: async () => {
      if (!seasonId) return null;
      const res = await fetch(`/api/seasons/${seasonId}/players`);
      if (!res.ok) throw new Error("Failed to fetch players");
      const data = await res.json();
      return { total: data.players?.length || 0 };
    },
    enabled: !!seasonId,
    staleTime: 60_000,
  });
}

/**
 * Combined hook for all competition overview stats
 */
export function useCompetitionOverviewStats(
  seasonId: string | undefined,
  competitionId: string | undefined
) {
  const fixtureStats = useSeasonFixtureStats(seasonId);
  const teamStats = useSeasonTeamStats(seasonId);
  const playerCount = useSeasonPlayerCount(seasonId);

  // Get last updated timestamp from standings query
  const queryClient = useQueryClient();
  const standingsQuery = queryClient.getQueryState(["season-standings", seasonId]);
  const lastUpdated = standingsQuery?.dataUpdatedAt
    ? new Date(standingsQuery.dataUpdatedAt).toISOString()
    : null;

  const hasLiveMatches = (fixtureStats.data?.liveCount || 0) > 0;

  return {
    teams: teamStats.data || { total: 0, active: 0 },
    fixtures: fixtureStats.data || { total: 0, scheduled: 0, inProgress: 0, completed: 0, liveCount: 0 },
    players: playerCount.data || { total: 0 },
    lastUpdated,
    hasLiveMatches,
    isLoading: fixtureStats.isLoading || teamStats.isLoading || playerCount.isLoading,
  };
}

/**
 * Hook to check if a season has fixtures generated
 */
export function useSeasonHasFixtures(seasonId: string | undefined) {
  return useQuery({
    queryKey: ["season-has-fixtures", seasonId],
    queryFn: async () => {
      if (!seasonId) return false;
      const res = await fetch(`/api/seasons/${seasonId}/fixtures`);
      if (!res.ok) return false;
      const data = await res.json();
      return (data.fixtures?.length || 0) > 0;
    },
    enabled: !!seasonId,
    staleTime: 60_000,
  });
}

/**
 * Hook to get previous season for trend comparison
 */
export function usePreviousSeason(competitionId: string | undefined, currentSeasonId: string | undefined) {
  return useQuery({
    queryKey: ["previous-season", competitionId, currentSeasonId],
    queryFn: async () => {
      if (!competitionId || !currentSeasonId) return null;
      const res = await fetch(`/api/competitions/${competitionId}/seasons`);
      if (!res.ok) return null;
      const data = await res.json();
      const seasons = data.seasons || [];
      const currentIndex = seasons.findIndex((s: any) => s.id === currentSeasonId);
      if (currentIndex > 0) {
        return seasons[currentIndex - 1];
      }
      return null;
    },
    enabled: !!competitionId && !!currentSeasonId,
    staleTime: 60_000,
  });
}