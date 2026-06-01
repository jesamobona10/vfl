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

  generatePlayoffMatches: () => void;
  generateCupBracketMatches: () => void;
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

  generatePlayoffMatches: () => {
    resetCupIdCounter();
    const teams = get().teams;
    const fixtures = get().fixtures;
    if (!teams.length) return;

    const standings = calculateStandings(teams, fixtures);
    const matches = generatePlayoffs(standings);
    set({
      cup: {
        matches,
        champion: null,
        playoffsGenerated: true,
        bracketGenerated: false,
      },
    });
  },

  generateCupBracketMatches: () => {
    const teams = get().teams;
    const fixtures = get().fixtures;
    const currentMatches = get().cup.matches;
    if (!teams.length) return;

    const standings = calculateStandings(teams, fixtures);
    const playoffMatches = currentMatches.filter((m: CupMatch) => m.round === "playoff");
    const bracketMatches = generateCupBracket(standings, playoffMatches);
    set({
      cup: {
        matches: [...currentMatches, ...bracketMatches],
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
