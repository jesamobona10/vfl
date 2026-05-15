import type { StateCreator } from "zustand";
import type { Team } from "../types";

export interface TeamsSlice {
  teams: Team[];

  setTeams: (teams: Team[]) => void;
  addTeam: (team: Team) => void;
  deleteTeam: (id: number) => void;
  updateTeam: (id: number, data: Partial<Team>) => void;
  resetTeams: () => void;
  setTeamLogo: (id: number, logo: string) => void;
  teamName: (id: number) => string;
  getTeam: (id: number) => Team | undefined;
}

const DEFAULT_TEAM_NAMES = [
  "FC Eagles", "United Stars", "Thunder Hawks",
  "Royal Knights", "Phoenix FC", "Ocean Warriors",
  "Golden Lions", "Silver Arrows", "Iron Bears",
  "Storm Breakers", "Crystal Palace Academy",
];

function normalizeTeams(): Team[] {
  return DEFAULT_TEAM_NAMES.map((name, index) => ({
    id: index + 1,
    name,
    rating: 6.0,
  }));
}

function getTeams(get: () => any): Team[] {
  return get().teams as Team[];
}

export const createTeamsSlice: StateCreator<any, [], [], TeamsSlice> = (
  set,
  get
) => ({
  teams: normalizeTeams(),

  setTeams: (teams) => set({ teams }),

  addTeam: (team) => {
    set({ teams: [...getTeams(get), team] });
  },

  deleteTeam: (id) => {
    set({ teams: getTeams(get).filter((t) => t.id !== id) });
  },

  updateTeam: (id, data) => {
    set({
      teams: getTeams(get).map((t) =>
        t.id === id ? { ...t, ...data } : t
      ),
    });
  },

  resetTeams: () => set({ teams: normalizeTeams() }),

  setTeamLogo: (id, logo) => {
    set({
      teams: getTeams(get).map((t) =>
        t.id === id ? { ...t, logo } : t
      ),
    });
  },

  teamName: (id) =>
    getTeams(get).find((t) => t.id === Number(id))?.name || "Unknown Team",

  getTeam: (id) => getTeams(get).find((t) => t.id === Number(id)),
});
