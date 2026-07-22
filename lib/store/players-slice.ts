import type { StateCreator } from "zustand";
import type { Player, Team, ImportResult } from "../types";
import { parseCSVPlayers } from "../utils/csv";
import { updatePlayerRatings, updateTeamRatings } from "../logic/ratings";

export interface PlayersSlice {
  players: Player[];

  setPlayers: (players: Player[]) => void;
  addPlayer: (player: Player) => void;
  updatePlayer: (id: number, data: Partial<Player>) => void;
  deletePlayer: (id: number) => void;
  deleteTeamPlayers: (teamId: number) => void;
  deleteAllPlayers: () => void;
  importPlayers: (csvText: string, teams: Team[]) => ImportResult;
  getTeamPlayers: (teamId: number) => Player[];
  getAllPlayers: () => Player[];
  recalculateRatings: () => void;
}

function getPlayers(get: () => any): Player[] {
  return get().players as Player[];
}

export const createPlayersSlice: StateCreator<
  any,
  [],
  [],
  PlayersSlice
> = (set, get) => ({
  players: [],

  setPlayers: (players) => set({ players }),

  addPlayer: (player) => {
    set({ players: [...getPlayers(get), player] });
  },

  updatePlayer: (id, data) => {
    set({
      players: getPlayers(get).map((p) =>
        p.id === id ? { ...p, ...data } : p
      ),
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

  getTeamPlayers: (teamId) =>
    getPlayers(get).filter((p) => p.teamId === teamId),

  getAllPlayers: () => getPlayers(get),

  recalculateRatings: () => {
    const players = getPlayers(get).map((p) => ({ ...p }));
    updatePlayerRatings(players);
    set({ players });
  },
});
