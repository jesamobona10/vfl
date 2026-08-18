import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  Competition,
  Season,
  OrganizationSeason,
  SeasonTeam,
  SeasonPlayerStats,
  SeasonTeamPlayer,
} from "@/lib/types";
import { fetchJson } from "@/lib/utils/fetch";

export function useCompetitions(orgId: string | undefined) {
  return useQuery({
    queryKey: ["competitions", orgId],
    queryFn: () =>
      fetchJson<{ competitions: Competition[] }>(`/api/competitions?org_id=${orgId}`).then(
        (d) => d.competitions
      ),
    enabled: !!orgId,
  });
}

export function useCompetition(id: string | undefined) {
  return useQuery({
    queryKey: ["competition", id],
    queryFn: () =>
      fetchJson<{ competition: Competition }>(`/api/competitions/${id}`).then((d) => d.competition),
    enabled: !!id,
  });
}

export function useSeasons(competitionId: string | undefined) {
  return useQuery({
    queryKey: ["seasons", competitionId],
    queryFn: () =>
      fetchJson<{ seasons: Season[] }>(`/api/competitions/${competitionId}/seasons`).then(
        (d) => d.seasons
      ),
    enabled: !!competitionId,
  });
}

export function useSeason(seasonId: string | undefined) {
  return useQuery({
    queryKey: ["season", seasonId],
    queryFn: () => fetchJson<{ season: Season }>(`/api/seasons/${seasonId}`).then((d) => d.season),
    enabled: !!seasonId,
  });
}

export function useCreateSeason() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      competitionId,
      name,
      short_name,
      start_date,
      end_date,
    }: {
      competitionId: string;
      name: string;
      short_name?: string;
      start_date?: string;
      end_date?: string;
    }) =>
      fetch(`/api/competitions/${competitionId}/seasons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, short_name, start_date, end_date }),
      }).then((res) => {
        if (!res.ok) throw new Error("Failed to create season");
        return res.json();
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["seasons", variables.competitionId] });
    },
  });
}

export function useUpdateSeason() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      competitionId,
      ...data
    }: { id: string; competitionId: string } & Record<string, unknown>) =>
      fetch(`/api/seasons/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((res) => {
        if (!res.ok) throw new Error("Failed to update season");
        return res.json();
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["seasons", variables.competitionId] });
      queryClient.invalidateQueries({ queryKey: ["season", variables.id] });
    },
  });
}

export function useUpdateCompetition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      fetch(`/api/competitions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((res) => {
        if (!res.ok) throw new Error("Failed to update competition");
        return res.json();
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["competition", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
    },
  });
}

export function useGenerateFixtures() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      competitionId,
      seasonId,
    }: {
      competitionId: string;
      seasonId?: string | null;
    }) =>
      fetch(`/api/competitions/${competitionId}/generate-fixtures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season_id: seasonId || undefined }),
      }).then((res) => {
        if (!res.ok) throw new Error("Failed to generate fixtures");
        return res.json();
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["competition", variables.competitionId] });
      if (variables.seasonId) {
        queryClient.invalidateQueries({ queryKey: ["season", variables.seasonId] });
        queryClient.invalidateQueries({ queryKey: ["seasons", variables.competitionId] });
      }
    },
  });
}

export function useSeasonTeams(seasonId: string | undefined) {
  return useQuery({
    queryKey: ["season-teams", seasonId],
    queryFn: () =>
      fetchJson<{ teams: SeasonTeam[] }>(`/api/seasons/${seasonId}/teams`).then((d) => d.teams),
    enabled: !!seasonId,
  });
}

export function useSeasonStandings(seasonId: string | undefined) {
  return useQuery({
    queryKey: ["season-standings", seasonId],
    queryFn: () =>
      fetchJson<{ standings: SeasonPlayerStats[] }>(`/api/seasons/${seasonId}/standings`).then(
        (d) => d.standings
      ),
    enabled: !!seasonId,
    refetchInterval: (query) => {
      // Only poll when the document is visible and the query is active
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        return 10_000;
      }
      return false;
    },
    refetchOnWindowFocus: true,
  });
}

export function useSeasonStatistics(seasonId: string | undefined) {
  return useQuery({
    queryKey: ["season-statistics", seasonId],
    queryFn: () =>
      fetchJson<{ statistics: Record<string, unknown> }>(
        `/api/seasons/${seasonId}/statistics`
      ).then((d) => d.statistics),
    enabled: !!seasonId,
    refetchInterval: (query) => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        return 10_000;
      }
      return false;
    },
    refetchOnWindowFocus: true,
  });
}

export function useCreateSeasonTeams(seasonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ teamIds }: { teamIds: number[] }) =>
      fetch(`/api/seasons/${seasonId}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_ids: teamIds }),
      }).then((res) => {
        if (!res.ok)
          return res
            .json()
            .then((d) => Promise.reject(new Error(d.error || "Failed to register teams")));
        return res.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["season-teams", seasonId] });
      queryClient.invalidateQueries({ queryKey: ["season-standings", seasonId] });
    },
  });
}

export function useDeleteSeasonTeam(seasonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (seasonTeamId: string) =>
      fetch(`/api/seasons/${seasonId}/teams/${seasonTeamId}`, { method: "DELETE" }).then((res) => {
        if (!res.ok)
          return res
            .json()
            .then((d) => Promise.reject(new Error(d.error || "Failed to unregister team")));
        return res.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["season-teams", seasonId] });
      queryClient.invalidateQueries({ queryKey: ["season-standings", seasonId] });
      queryClient.invalidateQueries({ queryKey: ["season-players", seasonId] });
    },
  });
}

export function useSeasonPlayers(seasonId: string | undefined) {
  return useQuery({
    queryKey: ["season-players", seasonId],
    queryFn: () =>
      fetchJson<{ players: SeasonTeamPlayer[] }>(`/api/seasons/${seasonId}/players`).then(
        (d) => d.players
      ),
    enabled: !!seasonId,
  });
}

export function useSeasonTeamPlayers(
  seasonId: string | undefined,
  seasonTeamId: string | undefined
) {
  return useQuery({
    queryKey: ["season-team-players", seasonTeamId],
    queryFn: () =>
      fetchJson<{ players: SeasonTeamPlayer[] }>(
        `/api/seasons/${seasonId}/teams/${seasonTeamId}/players`
      ).then((d) => d.players),
    enabled: !!seasonId && !!seasonTeamId,
  });
}

export function useRegisterSeasonPlayers(seasonId: string, seasonTeamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ playerIds }: { playerIds: number[] }) =>
      fetch(`/api/seasons/${seasonId}/teams/${seasonTeamId}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_ids: playerIds }),
      }).then((res) => {
        if (!res.ok)
          return res
            .json()
            .then((d) => Promise.reject(new Error(d.error || "Failed to register players")));
        return res.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["season-team-players", seasonTeamId] });
      queryClient.invalidateQueries({ queryKey: ["season-players"] });
    },
  });
}

export function useDeleteSeasonPlayer(seasonId: string, seasonTeamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (registrationId: string) =>
      fetch(`/api/seasons/${seasonId}/teams/${seasonTeamId}/players/${registrationId}`, {
        method: "DELETE",
      }).then((res) => {
        if (!res.ok)
          return res
            .json()
            .then((d) => Promise.reject(new Error(d.error || "Failed to remove player")));
        return res.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["season-team-players", seasonTeamId] });
      queryClient.invalidateQueries({ queryKey: ["season-players"] });
    },
  });
}

export function useCreateSeasonRollover(competitionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      from_season_id?: string;
      name?: string;
      short_name?: string;
      start_date?: string;
      end_date?: string;
    }) =>
      fetch(`/api/competitions/${competitionId}/seasons/rollover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((res) => {
        if (!res.ok)
          return res
            .json()
            .then((d) => Promise.reject(new Error(d.error || "Failed to create season")));
        return res.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seasons", competitionId] });
      queryClient.invalidateQueries({ queryKey: ["competition", competitionId] });
    },
  });
}

// ============================================================
// Org-level seasons (organization_seasons)
// ============================================================

export function useOrgSeasons(slug: string | undefined) {
  return useQuery({
    queryKey: ["org-seasons", slug],
    queryFn: () =>
      fetchJson<{ seasons: OrganizationSeason[] }>(`/api/organizations/${slug}/seasons`).then(
        (d) => d.seasons
      ),
    enabled: !!slug,
  });
}

export function useOrgSeason(slug: string | undefined, orgSeasonId: string | undefined) {
  return useQuery({
    queryKey: ["org-season", slug, orgSeasonId],
    queryFn: () =>
      fetchJson<{ season: OrganizationSeason }>(
        `/api/organizations/${slug}/seasons/${orgSeasonId}`
      ).then((d) => d.season),
    enabled: !!slug && !!orgSeasonId,
  });
}

export function useCreateOrgSeason(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      short_name?: string;
      start_date?: string;
      end_date?: string;
    }) =>
      fetch(`/api/organizations/${slug}/seasons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((res) => {
        if (!res.ok)
          return res
            .json()
            .then((d) => Promise.reject(new Error(d.error || "Failed to create season")));
        return res.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-seasons", slug] });
    },
  });
}

export function useUpdateOrgSeason(slug: string, orgSeasonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetch(`/api/organizations/${slug}/seasons/${orgSeasonId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((res) => {
        if (!res.ok)
          return res
            .json()
            .then((d) => Promise.reject(new Error(d.error || "Failed to update season")));
        return res.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-seasons", slug] });
      queryClient.invalidateQueries({ queryKey: ["org-season", slug, orgSeasonId] });
    },
  });
}

export function useDeleteOrgSeason(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orgSeasonId: string) =>
      fetch(`/api/organizations/${slug}/seasons/${orgSeasonId}`, { method: "DELETE" }).then(
        (res) => {
          if (!res.ok)
            return res
              .json()
              .then((d) => Promise.reject(new Error(d.error || "Failed to delete season")));
          return res.json();
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-seasons", slug] });
    },
  });
}
