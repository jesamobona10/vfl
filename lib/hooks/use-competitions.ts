import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Competition } from "@/lib/types";

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

export function useGenerateKnockout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (competitionId: string) =>
      fetch(`/api/competitions/${competitionId}/generate-knockout`, {
        method: "POST",
      }).then((res) => {
        if (!res.ok) throw new Error("Failed to generate knockout");
        return res.json();
      }),
    onSuccess: (_data, competitionId) => {
      queryClient.invalidateQueries({ queryKey: ["competition", competitionId] });
    },
  });
}
