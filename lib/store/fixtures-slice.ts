import type { StateCreator } from "zustand";
import type { FixtureRound, Match, NewMatchInput, RepairResult } from "../types";
import { pairKey } from "../utils/helpers";
import { generateRoundRobinFixtures } from "../logic/round-robin";
import { repairFixturesFromLocks } from "../logic/repair";
import { allMatches } from "../logic/standings";

export interface FixturesSlice {
  fixtures: FixtureRound[];
  repairNotice: string;

  setFixtures: (fixtures: FixtureRound[]) => void;
  generateFixtures: (teams: { id: number; name: string }[]) => void;
  addFixture: (input: NewMatchInput, teams: { id: number; name: string }[]) => {
    error?: string;
  };
  reorderMatch: (round: number, matchId: number, targetId: number) => void;
  updateMatch: (id: number, field: string, value: any) => void;
  setRepairNotice: (notice: string) => void;
  repairFixtures: () => RepairResult;
  swapTeamsAcrossFixtures: (
    oldTeamId: number,
    newTeamId: number,
    editedMatchId: number
  ) => number;
}

function getFixtures(get: () => any): FixtureRound[] {
  return get().fixtures as FixtureRound[];
}

export const createFixturesSlice: StateCreator<
  any,
  [],
  [],
  FixturesSlice
> = (set, get) => ({
  fixtures: [],
  repairNotice: "",

  setFixtures: (fixtures) => set({ fixtures }),

  generateFixtures: (teams) => {
    const result = generateRoundRobinFixtures(teams, getFixtures(get));
    set({ fixtures: result });
  },

  addFixture: (input, teams) => {
    const { homeId, awayId, date, time, venue } = input;
    if (!homeId || !awayId) return { error: "Select both home and away teams." };
    if (homeId === awayId)
      return { error: "Home and away teams must be different." };

    const newPairKey = pairKey(homeId, awayId);
    const existingPair = allMatches(getFixtures(get)).find(
      (m) => pairKey(m.homeId, m.awayId) === newPairKey
    );
    if (existingPair)
      return {
        error: `This pairing already exists in Round ${existingPair.round}.`,
      };

    const maxMatchesPerRound = Math.floor(teams.length / 2);
    let roundNum = input.round || 0;

    if (!roundNum) {
      roundNum = 1;
      while (true) {
        const r = getFixtures(get).find((f) => f.round === roundNum);
        if (!r) break;
        if (
          r.matches.length < maxMatchesPerRound &&
          !r.matches.some(
            (m) =>
              m.homeId === homeId ||
              m.awayId === homeId ||
              m.homeId === awayId ||
              m.awayId === awayId
          )
        )
          break;
        roundNum++;
      }
    } else {
      const existingRound = getFixtures(get).find(
        (r) => r.round === roundNum
      );
      if (existingRound) {
        if (existingRound.matches.length >= maxMatchesPerRound)
          return {
            error: `Round ${roundNum} already has ${maxMatchesPerRound} matches (maximum).`,
          };
        if (
          existingRound.matches.some(
            (m) =>
              m.homeId === homeId ||
              m.awayId === homeId ||
              m.homeId === awayId ||
              m.awayId === awayId
          )
        )
          return {
            error: `One of the teams is already playing in Round ${roundNum}.`,
          };
      }
    }

    const newMatch: Match = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      round: roundNum,
      homeId,
      awayId,
      homeScore: null,
      awayScore: null,
      status: "scheduled",
      date: date || "",
      time: time || "",
      venue: venue || "",
      events: [],
      manualEdited: true,
    };

    const fixtures = [...getFixtures(get)];
    let round = fixtures.find((r) => r.round === roundNum);
    if (round) {
      round = { ...round, matches: [...round.matches, newMatch] };
      fixtures[fixtures.findIndex((r) => r.round === roundNum)] = round;
    } else {
      fixtures.push({
        round: roundNum,
        byeId: null,
        matches: [newMatch],
      });
      fixtures.sort((a, b) => a.round - b.round);
    }

    set({ fixtures });
    return {};
  },

  reorderMatch: (round, matchId, targetId) => {
    if (matchId === targetId) return;
    const fixtures = [...getFixtures(get)];
    const roundIdx = fixtures.findIndex((r) => r.round === round);
    if (roundIdx === -1) return;

    const r = { ...fixtures[roundIdx], matches: [...fixtures[roundIdx].matches] };
    const sourceIdx = r.matches.findIndex((m) => m.id === matchId);
    const targetIdx = r.matches.findIndex((m) => m.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    const [moved] = r.matches.splice(sourceIdx, 1);
    r.matches.splice(targetIdx, 0, moved);
    fixtures[roundIdx] = r;
    set({ fixtures });
  },

  updateMatch: (id, field, value) => {
    const fixtures = getFixtures(get).map((r) => ({
      ...r,
      matches: r.matches.map((m) => {
        if (m.id !== Number(id)) return m;
        const updated = { ...m };
        const isTeamLocked =
          updated.status === "completed" ||
          updated.status === "scheduled" ||
          updated.status === "in-progress" ||
          updated.status === "live" ||
          updated.manualEdited;

        if (field === "homeScore" || field === "awayScore") {
          const parsed = Number.parseInt(value, 10);
          updated[field] =
            value === ""
              ? null
              : Number.isFinite(parsed)
              ? Math.max(0, parsed)
              : null;
          if (
            Number.isInteger(updated.homeScore) &&
            Number.isInteger(updated.awayScore) &&
            updated.status === "scheduled"
          ) {
            updated.status = "completed";
          }
        } else if (field === "homeId" || field === "awayId") {
          if (isTeamLocked) return m;
          const oldTeamId = updated[field];
          const newTeamId = Number(value);
          if (oldTeamId === newTeamId) return m;
          updated[field] = newTeamId;
          updated.manualEdited = true;
          updated.autoAdjusted = false;
          // swapTeamsAcrossFixtures handled separately
        } else {
          (updated as any)[field] = value;
        }

        if (
          updated.status === "completed" &&
          (!Number.isInteger(updated.homeScore) ||
            !Number.isInteger(updated.awayScore))
        ) {
          updated.status = "scheduled";
        }
        if (!updated.events) updated.events = [];
        return updated;
      }),
    }));
    set({ fixtures, repairNotice: "" });
  },

  setRepairNotice: (notice) => set({ repairNotice: notice }),

  repairFixtures: () => {
    const result = repairFixturesFromLocks(
      getFixtures(get),
      get().teams as any
    );
    if (result.ok) {
      set({ fixtures: [...getFixtures(get)] });
    }
    return result;
  },

  swapTeamsAcrossFixtures: (oldTeamId, newTeamId, editedMatchId) => {
    let changed = 0;
    const fixtures = getFixtures(get).map((r) => ({
      ...r,
      matches: r.matches.map((candidate) => {
        if (candidate.id === editedMatchId) return candidate;
        const prevHome = candidate.homeId;
        const prevAway = candidate.awayId;
        let c = { ...candidate };

        if (c.homeId === oldTeamId) c.homeId = newTeamId;
        else if (c.homeId === newTeamId) c.homeId = oldTeamId;

        if (c.awayId === oldTeamId) c.awayId = newTeamId;
        else if (c.awayId === newTeamId) c.awayId = oldTeamId;

        if (c.homeId !== prevHome || c.awayId !== prevAway) {
          c.autoAdjusted = true;
          changed += 1;
        }
        return c;
      }),
    }));
    set({ fixtures });
    return changed;
  },
});
