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
import type { CupSlice } from "./cup-slice";
import { createCupSlice } from "./cup-slice";
import type { OrgSlice } from "./org-slice";
import { createOrgSlice } from "./org-slice";
import type { CompetitionSlice } from "./competition-slice";
import { createCompetitionSlice } from "./competition-slice";

export type AppStore = AuthSlice & TeamsSlice & FixturesSlice & PlayersSlice & CupSlice & OrgSlice & CompetitionSlice;

export const useAppStore = create<AppStore>()(
  persist(
    (...a) => ({
      ...createAuthSlice(...a),
      ...createTeamsSlice(...a),
      ...createFixturesSlice(...a),
      ...createPlayersSlice(...a),
      ...createCupSlice(...a),
      ...createOrgSlice(...a),
      ...createCompetitionSlice(...a),
    }),
    {
      name: "vfl-app-state",
      partialize: (state) => ({
        teams: state.teams,
        fixtures: state.fixtures,
        players: state.players,
        cup: state.cup,
        currentOrg: state.currentOrg,
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
