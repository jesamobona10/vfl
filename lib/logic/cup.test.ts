import { beforeEach, describe, expect, it } from "vitest";
import {
  computeWinner,
  generateCupBracketFromTeams,
  getChampion,
  resetCupIdCounter,
  resolveBracketSlot,
} from "@/lib/logic/cup";
import type { CupMatch, Team } from "@/lib/types";

function makeTeams(n: number): Team[] {
  // descending ratings so seeding is deterministic: team 1 is strongest
  return Array.from({ length: n }, (_, i) => ({
    id: n - i,
    name: `Seed ${i + 1}`,
    rating: 10 - i * 0.1,
  }));
}

beforeEach(() => {
  resetCupIdCounter();
});

describe("generateCupBracketFromTeams — structural invariants", () => {
  function assertBracketIntegrity(n: number) {
    const bracket = generateCupBracketFromTeams(makeTeams(n));

    // single elimination always needs exactly N-1 eliminations/matches
    expect(bracket).toHaveLength(n - 1);

    // ids unique and monotonically increasing (creation order = round order)
    const ids = bracket.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort((a, b) => a - b)).toEqual(ids);

    // exactly one final, and it is created last
    const finals = bracket.filter((m) => m.round === "final");
    expect(finals).toHaveLength(1);
    expect(finals[0]!.id).toBe(ids[ids.length - 1]!);

    // every team enters the bracket exactly once as a direct entrant
    // (byed seeds slot into later rounds; everyone else plays round 1)
    const directEntrants = new Set<number>();
    for (const m of bracket) {
      if (m.homeId != null && m.homeFromMatchId === undefined) directEntrants.add(m.homeId);
      if (m.awayId != null && m.awayFromMatchId === undefined) directEntrants.add(m.awayId);
    }
    expect(directEntrants.size).toBe(n);

    // every feeder reference points to an earlier-created match
    const earlier = new Set<number>();
    for (const m of bracket) {
      for (const ref of [m.homeFromMatchId, m.awayFromMatchId]) {
        if (ref !== undefined) expect(earlier.has(ref)).toBe(true);
      }
      earlier.add(m.id);
    }

    // no team appears twice as a direct entrant, and play-in participants
    // never double up with bye recipients
    return bracket;
  }

  it.each([2, 4, 8, 16])("power-of-two field of %i teams", (n) => {
    const bracket = assertBracketIntegrity(n);

    // power of two → no byes → every match's feeders are teams in round 1
    const firstPhase = bracket[0]!.round;
    for (const m of bracket.filter((x) => x.round === firstPhase)) {
      expect(m.homeFromMatchId).toBeUndefined();
      expect(m.awayFromMatchId).toBeUndefined();
    }
  });

  it.each([3, 5, 6, 7, 12, 20])("non-power-of-two field of %i teams", (n) => {
    assertBracketIntegrity(n);
  });

  it("enters every team exactly once across all direct slots", () => {
    const bracket = generateCupBracketFromTeams(makeTeams(9));
    const directSlots: number[] = [];
    for (const m of bracket) {
      if (m.homeId != null && m.homeFromMatchId === undefined) directSlots.push(m.homeId);
      if (m.awayId != null && m.awayFromMatchId === undefined) directSlots.push(m.awayId);
    }
    // no duplicates: a team must never be able to lose twice or walk in twice
    expect(new Set(directSlots).size).toBe(directSlots.length);
    expect(directSlots.length).toBe(9);
  });

  // OBSERVATION (not asserted): for non-power-of-two fields the generator
  // pairs leftover bye seeds against each other (e.g. 6-team cup → seeds 1
  // and 2 meet in the semi) instead of standard interleaved seeding where a
  // bye seed faces a play-in winner. Fairness improvement candidate.
});

describe("computeWinner", () => {
  function base(overrides: Partial<CupMatch>): CupMatch {
    return {
      id: 1,
      round: "quarter",
      matchIndex: 0,
      homeId: 1,
      awayId: 2,
      homeScore: null,
      awayScore: null,
      homeETScore: null,
      awayETScore: null,
      homePenScore: null,
      awayPenScore: null,
      status: "completed",
      winnerId: null,
      completedVia: null,
      date: "",
      time: "",
      venue: "",
      ...overrides,
    };
  }

  it("decides in regular time first", () => {
    const { winnerId, completedVia } = computeWinner(base({ homeScore: 2, awayScore: 1 }));
    expect(winnerId).toBe(1);
    expect(completedVia).toBe("regular");
  });

  it("falls to extra time on a regular-time draw", () => {
    const { winnerId, completedVia } = computeWinner(
      base({ homeScore: 1, awayScore: 1, homeETScore: 2, awayETScore: 1 })
    );
    expect(winnerId).toBe(1);
    expect(completedVia).toBe("extra_time");
  });

  it("falls to penalties when ET is also level", () => {
    const { winnerId, completedVia } = computeWinner(
      base({ homeScore: 0, awayScore: 0, homeETScore: 1, awayETScore: 1, homePenScore: 4, awayPenScore: 3 })
    );
    expect(winnerId).toBe(1);
    expect(completedVia).toBe("penalties");
  });

  it("returns null while everything is still level or unscored", () => {
    expect(computeWinner(base({}))).toEqual({ winnerId: null, completedVia: null });
    expect(computeWinner(base({ homeScore: 1, awayScore: 1 }))).toEqual({
      winnerId: null,
      completedVia: null,
    });
  });
});

describe("resolveBracketSlot", () => {
  it("routes the winner into the correct semi-final slot without mutating input", () => {
    const qf1: CupMatch = {
      id: 10, round: "quarter", matchIndex: 0, homeId: 1, awayId: 2,
      homeScore: 1, awayScore: 0, homeETScore: null, awayETScore: null,
      homePenScore: null, awayPenScore: null, status: "completed",
      winnerId: 1, completedVia: "regular", date: "", time: "", venue: "",
    };
    const semi: CupMatch = {
      id: 20, round: "semi", matchIndex: 0, homeId: null, awayId: null,
      homeFromMatchId: 10, awayFromMatchId: 11,
      homeScore: null, awayScore: null, homeETScore: null, awayETScore: null,
      homePenScore: null, awayPenScore: null, status: "scheduled",
      winnerId: null, completedVia: null, date: "", time: "", venue: "",
    };

    const result = resolveBracketSlot([qf1, semi], 10, 1);

    expect(result[1]!.homeId).toBe(1); // winner slotted home
    expect(result[1]!.awayId).toBeNull(); // other slot untouched
    expect(semi.homeId).toBeNull(); // original not mutated
    expect(qf1.winnerId).toBe(1);
  });
});

describe("getChampion", () => {
  it("is null until the final completes with a winner", () => {
    const final: CupMatch = {
      id: 99, round: "final", matchIndex: 0, homeId: 1, awayId: 2,
      homeScore: 1, awayScore: 0, homeETScore: null, awayETScore: null,
      homePenScore: null, awayPenScore: null, status: "scheduled",
      winnerId: null, completedVia: null, date: "", time: "", venue: "",
    };
    expect(getChampion([final])).toBeNull();

    final.status = "completed";
    final.winnerId = 1;
    expect(getChampion([final])).toBe(1);
  });

  it("ignores completed non-final matches", () => {
    const semi: CupMatch = {
      id: 5, round: "semi", matchIndex: 0, homeId: 1, awayId: 2,
      homeScore: 2, awayScore: 0, homeETScore: null, awayETScore: null,
      homePenScore: null, awayPenScore: null, status: "completed",
      winnerId: 1, completedVia: "regular", date: "", time: "", venue: "",
    };
    expect(getChampion([semi])).toBeNull();
  });
});
