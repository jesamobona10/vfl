import type { StateCreator } from "zustand";
import type { Competition } from "../types";
import type { AppStore } from "./index";

/** Competition state slice managing competition and season data. */
export interface CompetitionSlice {
  /** All competitions for the current organization. */
  competitions: Competition[];
  /** The currently viewed competition. */
  currentCompetition: Competition | null;
  /** The currently active season ID. */
  currentSeasonId: string | null;

  /** Set the current competition. */
  setCurrentCompetition: (comp: Competition | null) => void;
  /** Set the current season ID. */
  setCurrentSeasonId: (seasonId: string | null) => void;
  /** Fetch all competitions for an organization. */
  fetchCompetitions: (orgId: string) => Promise<void>;
  /** Fetch a single competition by ID. */
  fetchCompetition: (id: string) => Promise<Competition | null>;
}

export const createCompetitionSlice: StateCreator<AppStore, [], [], CompetitionSlice> = (set) => ({
  competitions: [],
  currentCompetition: null,
  currentSeasonId: null,

  setCurrentCompetition: (comp) => set({ currentCompetition: comp }),
  setCurrentSeasonId: (seasonId) => set({ currentSeasonId: seasonId }),

  fetchCompetitions: async (orgId) => {
    try {
      const res = await fetch(`/api/competitions?org_id=${orgId}`);
      if (!res.ok) return;
      const data = await res.json();
      set({ competitions: data.competitions || [] });
    } catch (error) {
      console.error("fetchCompetitions failed:", error);
    }
  },

  fetchCompetition: async (id) => {
    try {
      const res = await fetch(`/api/competitions/${id}`);
      if (!res.ok) return null;
      const data = await res.json();
      const comp: Competition = data.competition;
      set({ currentCompetition: comp });
      if (comp.current_season_id) {
        set({ currentSeasonId: comp.current_season_id });
      }
      return comp;
    } catch (error) {
      console.error("fetchCompetition failed:", error);
      return null;
    }
  },
});
