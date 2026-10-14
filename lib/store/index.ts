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

export type AppStore = AuthSlice &
  TeamsSlice &
  FixturesSlice &
  PlayersSlice &
  CupSlice &
  OrgSlice &
  CompetitionSlice & {
    /** Reverts every slice to its initial empty state (used on logout). */
    resetAll: () => void;
  };

let initialState: AppStore | undefined;

export const useAppStore = create<AppStore>()(
  persist(
    (set, get, api) => {
      const composed = {
        ...createAuthSlice(set, get, api),
        ...createTeamsSlice(set, get, api),
        ...createFixturesSlice(set, get, api),
        ...createPlayersSlice(set, get, api),
        ...createCupSlice(set, get, api),
        ...createOrgSlice(set, get, api),
        ...createCompetitionSlice(set, get, api),
      } as AppStore;
      const withReset = {
        ...composed,
        resetAll: () => set(initialState as AppStore, true),
      };
      initialState ??= { ...withReset };
      return withReset;
    },
    {
      name: "vfl-app-state",
      // Server-fetched, season-scoped slices (teams, fixtures, players) are
      // deliberately not persisted: stale persisted season data is rehydrated
      // after the selected season has already loaded, which makes the UI flip
      // between seasons. They are always refetched from the server on load.
      partialize: (state) => ({
        cup: state.cup,
      }),
    }
  )
);
