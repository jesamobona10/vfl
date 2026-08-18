import type { StateCreator } from "zustand";
import type { Player, Team, ImportResult } from "../types";
import { parseCSVPlayers } from "../utils/csv";
import { updatePlayerRatings, updateTeamRatings } from "../logic/ratings";
import type { AppStore } from "./index";

/** Players state slice managing the global player list. */
export interface PlayersSlice {
  /** All players in the current context. */
  players: Player[];

  /** Replace the entire player list. */
  setPlayers: (players: Player[]) => void;
  /** Add a single player. */
  addPlayer: (player: Player) => void;
  /** Update a player's fields by ID. */
  updatePlayer: (id: number, data: Partial<Player>) => void;
  /** Remove a player by ID. */
  deletePlayer: (id: number) => void;
  /** Remove all players belonging to a team. */
  deleteTeamPlayers: (teamId: number) => void;
  /** Remove all players. */
  deleteAllPlayers: () => void;
  /** Import players from CSV text, filtered by the provided teams. */
  importPlayers: (csvText: string, teams: Team[]) => ImportResult;
  /** Get all players for a specific team. */
  getTeamPlayers: (teamId: number) => Player[];
  /** Get all players. */
  getAllPlayers: () => Player[];
  /** Recalculate all player and team ratings based on current stats. */
  recalculateRatings: () => void;
}

function getPlayers(get: () => AppStore): Player[] {
  return get().players;
}

export const createPlayersSlice: StateCreator<AppStore, [], [], PlayersSlice> = (set, get) => ({
  players: [],

  setPlayers: (players) => set({ players }),

  addPlayer: (player) => {
    set({ players: [...getPlayers(get), player] });
  },

  updatePlayer: (id, data) => {
    set({
      players: getPlayers(get).map((p) => (p.id === id ? { ...p, ...data } : p)),
    });
  },

  deletePlayer: (id) => {
    set({
      players: getPlayers(get).filter((p) => p.id !== id),
    });
  },

  deleteTeamPlayers: (teamId) => {
    set({ players: getPlayers(get).filter((p) => p.teamId !== teamId) });
  },

  deleteAllPlayers: () => set({ players: [] }),

  importPlayers: (csvText, teams) => {
    const result = parseCSVPlayers(csvText, teams, getPlayers(get));
    if (result.imported.length > 0) {
      set({ players: [...getPlayers(get), ...result.imported] });
    }
    return result;
  },

  getTeamPlayers: (teamId) => getPlayers(get).filter((p) => p.teamId === teamId),

  getAllPlayers: () => getPlayers(get),

  recalculateRatings: () => {
    const players = getPlayers(get).map((p) => ({ ...p }));
    updatePlayerRatings(players);
    set({ players });
    const state = get();
    if (state.teams && state.fixtures) {
      const teams = state.teams.map((t) => ({ ...t }));
      const allMatchList = state.fixtures.flatMap((r) => r.matches || []);
      updateTeamRatings(teams, allMatchList, players);
      state.setTeams(teams);
    }
  },
});
