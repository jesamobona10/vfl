import type { StateCreator } from "zustand";
import type { Player, ImportResult } from "../types";
import { parseCSVPlayers } from "../utils/csv";

export interface PlayersSlice {
  players: Player[];

  setPlayers: (players: Player[]) => void;
  addPlayer: (player: Player) => void;
  updatePlayer: (id: number, data: Partial<Player>) => void;
  deletePlayer: (id: number) => void;
  deleteTeamPlayers: (teamId: number) => void;
  deleteAllPlayers: () => void;
  importPlayers: (csvText: string, teams: { id: number; name: string }[]) => ImportResult;
  getTeamPlayers: (teamId: number) => Player[];
  getAllPlayers: () => Player[];
  recalculateRatings: () => void;
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
    set({ players: [...get().players, player] });
  },

  updatePlayer: (id, data) => {
    set({
      players: get().players.map((p) =>
        p.id === id ? { ...p, ...data } : p
      ),
    });
  },

  deletePlayer: (id) => {
    set({
      players: get().players.filter((p) => p.id !== id),
    });
  },

  deleteTeamPlayers: (teamId) => {
    set({ players: get().players.filter((p) => p.teamId !== teamId) });
  },

  deleteAllPlayers: () => set({ players: [] }),

  importPlayers: (csvText, teams) => {
    const result = parseCSVPlayers(csvText, teams, get().players);
    if (result.imported.length > 0) {
      set({ players: [...get().players, ...result.imported] });
    }
    return result;
  },

  getTeamPlayers: (teamId) =>
    get().players.filter((p) => p.teamId === teamId),

  getAllPlayers: () => get().players,

  recalculateRatings: () => {
    set({
      players: get().players.map((p) => ({ ...p })),
    });
  },
});
