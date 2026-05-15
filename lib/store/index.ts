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
    }
  )
);
