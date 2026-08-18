import type { StateCreator } from "zustand";
import type { Team } from "../types";
import type { AppStore } from "./index";

/** Teams state slice managing the global team list. */
export interface TeamsSlice {
  /** All teams in the current context. */
  teams: Team[];

  /** Replace the entire team list. */
  setTeams: (teams: Team[]) => void;
  /** Add a single team to the list. */
  addTeam: (team: Team) => void;
  /** Remove a team by ID. */
  deleteTeam: (id: number) => void;
  /** Update a team's fields by ID. */
  updateTeam: (id: number, data: Partial<Team>) => void;
  /** Reset teams to the default list. */
  resetTeams: () => void;
  /** Set the logo URL for a team. */
  setTeamLogo: (id: number, logo: string) => void;
  /** Get a team's display name by ID. */
  teamName: (id: number) => string;
  /** Get a team object by ID. */
  getTeam: (id: number) => Team | undefined;
}

const DEFAULT_TEAM_NAMES = [
  "FC Eagles",
  "United Stars",
  "Thunder Hawks",
  "Royal Knights",
  "Phoenix FC",
  "Ocean Warriors",
  "Golden Lions",
  "Silver Arrows",
  "Iron Bears",
  "Storm Breakers",
  "Crystal Palace Academy",
];

function normalizeTeams(): Team[] {
  return DEFAULT_TEAM_NAMES.map((name, index) => ({
    id: index + 1,
    name,
    rating: 6.0,
  }));
}

function getTeams(get: () => AppStore): Team[] {
  return get().teams;
}

export const createTeamsSlice: StateCreator<AppStore, [], [], TeamsSlice> = (set, get) => ({
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
      teams: getTeams(get).map((t) => (t.id === id ? { ...t, ...data } : t)),
    });
  },

  resetTeams: () => set({ teams: normalizeTeams() }),

  setTeamLogo: (id, logo) => {
    set({
      teams: getTeams(get).map((t) => (t.id === id ? { ...t, logo } : t)),
    });
  },

  teamName: (id) => getTeams(get).find((t) => t.id === Number(id))?.name || "Unknown Team",

  getTeam: (id) => getTeams(get).find((t) => t.id === Number(id)),
});
