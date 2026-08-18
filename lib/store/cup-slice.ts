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
import type { AppStore } from "./index";

/** Cup/bracket competition state slice. */
export interface CupSlice {
  /** Current cup bracket state. */
  cup: CupState;

  /** Generate the full knockout bracket from current standings. */
  generateKnockoutStage: () => void;
  /** Update fields on a specific cup match. */
  updateCupMatch: (id: number, data: Partial<CupMatch>) => void;
  /** Complete a cup match by computing the winner. */
  completeCupMatch: (id: number) => void;
  /** Reset the cup bracket to its initial empty state. */
  resetCup: () => void;
}

const initialCupState: CupState = {
  matches: [],
  champion: null,
  playoffsGenerated: false,
  bracketGenerated: false,
};

export const createCupSlice: StateCreator<AppStore, [], [], CupSlice> = (set, get) => ({
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
    const matches = current.matches.map((m) => (m.id === id ? { ...m, ...data } : m));
    set({ cup: { ...current, matches } });
  },

  completeCupMatch: (id) => {
    const current = get().cup;
    const match = current.matches.find((m) => m.id === id);
    if (!match) return;

    const { winnerId, completedVia } = computeWinner(match);
    if (winnerId == null) return;

    let matches = current.matches.map((m) =>
      m.id === id ? { ...m, status: "completed" as const, winnerId, completedVia } : m
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
