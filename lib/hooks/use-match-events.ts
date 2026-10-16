import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Match, Team } from "@/lib/types";
import {
  deleteMatchEvent,
  submitMatchEvent,
  type LogMatchEventInput,
  type ServerMatchEvent,
} from "@/lib/match-logger/submit-match-event";

export interface MatchLoggerFixture {
  match: Match;
  organizationId: string | null;
  homeTeam: Team | null;
  awayTeam: Team | null;
}

/**
 * Loads a single fixture (with its events) for the Match Logger.
 *
 * Reuses `GET /api/fixtures/[id]`, which already authorizes org admins and
 * coaches of either side and returns the mapped match plus both teams.
 */
export function useMatchEvents(fixtureId: number | undefined) {
  return useQuery({
    queryKey: ["match-logger-fixture", fixtureId],
    enabled: typeof fixtureId === "number" && Number.isFinite(fixtureId),
    queryFn: async () => {
      const res = await fetch(`/api/fixtures/${fixtureId}`);
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) {
        throw new Error(body?.error || "Unable to load the match.");
      }
      return body as MatchLoggerFixture;
    },
  });
}

/** Adds an event and refreshes the fixture and live lists on success. */
export function useLogMatchEvent(fixtureId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation<ServerMatchEvent, Error, LogMatchEventInput>({
    mutationFn: (input) => submitMatchEvent(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["match-logger-fixture", fixtureId] });
      queryClient.invalidateQueries({ queryKey: ["live-fixtures"] });
    },
  });
}

/** Deletes an event and refreshes the fixture and live lists on success. */
export function useDeleteMatchEvent(fixtureId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: (eventId) => deleteMatchEvent(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["match-logger-fixture", fixtureId] });
      queryClient.invalidateQueries({ queryKey: ["live-fixtures"] });
    },
  });
}
