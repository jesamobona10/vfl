import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Competition, Season } from "@/lib/types";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

export function useCompetitions(orgId: string | undefined) {
  return useQuery({
    queryKey: ["competitions", orgId],
    queryFn: () =>
      fetchJson<{ competitions: Competition[] }>(
        `/api/competitions?org_id=${orgId}`
      ).then((d) => d.competitions),
    enabled: !!orgId,
  });
}

export function useCompetition(id: string | undefined) {
  return useQuery({
    queryKey: ["competition", id],
    queryFn: () =>
      fetchJson<{ competition: Competition }>(`/api/competitions/${id}`).then(
        (d) => d.competition
      ),
    enabled: !!id,
  });
}

export function useSeasons(competitionId: string | undefined) {
  return useQuery({
    queryKey: ["seasons", competitionId],
    queryFn: () =>
      fetchJson<{ seasons: Season[] }>(
        `/api/competitions/${competitionId}/seasons`
      ).then((d) => d.seasons),
    enabled: !!competitionId,
  });
}

export function useSeason(seasonId: string | undefined) {
  return useQuery({
    queryKey: ["season", seasonId],
    queryFn: () =>
      fetchJson<{ season: Season }>(`/api/seasons/${seasonId}`).then(
        (d) => d.season
      ),
    enabled: !!seasonId,
  });
}

export function useCreateSeason() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      competitionId,
      name,
      start_date,
      end_date,
    }: {
      competitionId: string;
      name: string;
      start_date?: string;
      end_date?: string;
    }) =>
      fetch(`/api/competitions/${competitionId}/seasons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, start_date, end_date }),
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
    mutationFn: ({
      id,
      ...data
    }: { id: string } & Record<string, unknown>) =>
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
    mutationFn: (competitionId: string) =>
      fetch(`/api/competitions/${competitionId}/generate-fixtures`, {
        method: "POST",
      }).then((res) => {
        if (!res.ok) throw new Error("Failed to generate fixtures");
        return res.json();
      }),
    onSuccess: (_data, competitionId) => {
      queryClient.invalidateQueries({ queryKey: ["competition", competitionId] });
    },
  });
}

