import type { StateCreator } from "zustand";
import type { CupMatch, CupState } from "../types";
import {
  generatePlayoffs,
  generateCupBracket,
  computeWinner,
  resolveBracketSlot,
  getChampion,
  resetCupIdCounter,
} from "../logic/cup";
import { calculateStandings } from "../logic/standings";

export interface CupSlice {
  cup: CupState;

  generateKnockoutStage: () => void;
  updateCupMatch: (id: number, data: Partial<CupMatch>) => void;
  completeCupMatch: (id: number) => void;
  resetCup: () => void;
}

const initialCupState: CupState = {
  matches: [],
  champion: null,
  playoffsGenerated: false,
  bracketGenerated: false,
};

export const createCupSlice: StateCreator<any, [], [], CupSlice> = (set, get) => ({
  cup: { ...initialCupState },

  generateKnockoutStage: () => {
    resetCupIdCounter();
    const teams = get().teams;
    const fixtures = get().fixtures;
    if (!teams.length) return;

    const standings = calculateStandings(teams, fixtures);
    const playoffMatches = generatePlayoffs(standings);
    const bracketMatches = generateCupBracket(standings, playoffMatches);
    set({
      cup: {
        matches: [...playoffMatches, ...bracketMatches],
        champion: null,
        playoffsGenerated: true,
        bracketGenerated: true,
      },
    });
  },

  updateCupMatch: (id, data) => {
    const current = get().cup;
    const matches = current.matches.map((m: CupMatch) =>
      m.id === id ? { ...m, ...data } : m
    );
    set({ cup: { ...current, matches } });
  },

  completeCupMatch: (id) => {
    const current = get().cup;
    const match = current.matches.find((m: CupMatch) => m.id === id);
    if (!match) return;

    const { winnerId, completedVia } = computeWinner(match);
    if (winnerId == null) return;

    let matches = current.matches.map((m: CupMatch) =>
      m.id === id
        ? { ...m, status: "completed" as const, winnerId, completedVia }
        : m
    );

    matches = resolveBracketSlot(matches, id, winnerId);

    const champion = getChampion(matches);

    set({
      cup: {
        ...current,
        matches,
        champion,
      },
    });
  },

  resetCup: () => {
    set({ cup: { ...initialCupState } });
  },
});
