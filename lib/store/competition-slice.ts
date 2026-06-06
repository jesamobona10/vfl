import type { StateCreator } from "zustand";
import type { Competition } from "../types";

export interface CompetitionSlice {
  competitions: Competition[];
  currentCompetition: Competition | null;

  setCurrentCompetition: (comp: Competition | null) => void;
  fetchCompetitions: (orgId: string) => Promise<void>;
  fetchCompetition: (id: string) => Promise<Competition | null>;
}

export const createCompetitionSlice: StateCreator<any, [], [], CompetitionSlice> = (
  set
) => ({
  competitions: [],
  currentCompetition: null,

  setCurrentCompetition: (comp) => set({ currentCompetition: comp }),

  fetchCompetitions: async (orgId) => {
    try {
      const res = await fetch(`/api/competitions?org_id=${orgId}`);
      if (!res.ok) return;
      const data = await res.json();
      set({ competitions: data.competitions || [] });
    } catch {
      // silently fail
    }
  },

  fetchCompetition: async (id) => {
    try {
      const res = await fetch(`/api/competitions/${id}`);
      if (!res.ok) return null;
      const data = await res.json();
      const comp: Competition = data.competition;
      set({ currentCompetition: comp });
      return comp;
    } catch {
      return null;
    }
  },
});
