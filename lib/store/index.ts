import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthSlice } from "./auth-slice";
import { createAuthSlice } from "./auth-slice";
import type { TeamsSlice } from "./teams-slice";
import { createTeamsSlice } from "./teams-slice";
import type { FixturesSlice } from "./fixtures-slice";
import { createFixturesSlice } from "./fixtures-slice";
import type { PlayersSlice } from "./players-slice";
import { createPlayersSlice } from "./players-slice";

export type AppStore = AuthSlice & TeamsSlice & FixturesSlice & PlayersSlice;

export const useAppStore = create<AppStore>()(
  persist(
    (...a) => ({
      ...createAuthSlice(...a),
      ...createTeamsSlice(...a),
      ...createFixturesSlice(...a),
      ...createPlayersSlice(...a),
    }),
    {
      name: "vfl-app-state",
      partialize: (state) => ({
        teams: state.teams,
        fixtures: state.fixtures,
        players: state.players,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const teamIds = new Set(
          (state.teams as { id: number }[] | undefined)?.map((t) => t.id)
        );
        if (!teamIds.size) return;
        const hasOrphanedMatches = (
          state.fixtures as { matches: { homeId: number; awayId: number }[] }[]
        )?.some((r) =>
          r.matches?.some(
            (m) => !teamIds.has(m.homeId) || !teamIds.has(m.awayId)
          )
        );
        if (hasOrphanedMatches) {
          (
            state as { setFixtures?: (f: []) => void }
          ).setFixtures?.([]);
        }
      },
    }
  )
);
