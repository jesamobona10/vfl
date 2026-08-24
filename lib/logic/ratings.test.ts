import { beforeEach, describe, expect, it } from "vitest";
import { updatePlayerRatings, updateTeamRatings } from "@/lib/logic/ratings";
import type { Match, Player, Team } from "@/lib/types";

let nextPlayerId = 1;

function makePlayer(position: Player["position"], overrides: Partial<Player> = {}): Player {
  return {
    id: nextPlayerId++,
    teamId: 1,
    name: `Player ${nextPlayerId}`,
    position,
    number: 1,
    goals: 0,
    assists: 0,
    ownGoals: 0,
    yellowCards: 0,
    redCards: 0,
    saves: 0,
    penaltySaves: 0,
    cleanSheets: 0,
    motm: 0,
    tackles: 0,
    interceptions: 0,
    blocks: 0,
    aerialDuelsWon: 0,
    errorsLeadingToGoal: 0,
    penaltiesConceded: 0,
    goalsConceded: 0,
    matchWins: 0,
    bonus5Saves: 0,
    captain: false,
    rating: 6.0,
    matchRatings: {},
    ...overrides,
  };
}

beforeEach(() => {
  nextPlayerId = 1;
});

describe("updatePlayerRatings", () => {
  it("baseline rating is 6.0 for a player with no stats", () => {
    const player = makePlayer("MID");
    updatePlayerRatings([player]);
    expect(player.rating).toBe(6.0);
  });

  it("GK ratings reward clean sheets and penalty saves, punish concessions", () => {
    const good = makePlayer("GK", { cleanSheets: 2, penaltySaves: 1 });
    const bad = makePlayer("GK", { goalsConceded: 10, redCards: 1 });
    updatePlayerRatings([good, bad]);

    // 6 + 2*2 + 3 = 13 → clamped
    expect(good.rating).toBe(10.0);
    // 6 - 3 - 3 = 0 → clamped
    expect(bad.rating).toBe(1.0);
  });

  it("weights goals by position (ATT > MID)", () => {
    const att = makePlayer("ATT", { goals: 1 });
    const mid = makePlayer("MID", { goals: 1 });
    updatePlayerRatings([att, mid]);
    expect(att.rating).toBe(6 + 3);
    expect(mid.rating).toBe(6 + 2);
    expect(att.rating).toBeGreaterThan(mid.rating);
  });

  it("DEF rewards defensive stats", () => {
    const def = makePlayer("DEF", { tackles: 2, interceptions: 5, blocks: 2, aerialDuelsWon: 5 });
    updatePlayerRatings([def]);
    // 6 + 0.6 + 1 + 0.6 + 1
    expect(def.rating).toBeCloseTo(9.2, 5);
  });

  it("clamps ratings into [1, 10]", () => {
    const terrible = makePlayer("ATT", { redCards: 100, ownGoals: 100, errorsLeadingToGoal: 100 });
    const amazing = makePlayer("ATT", { goals: 100, assists: 100, motm: 100, matchWins: 100 });
    updatePlayerRatings([terrible, amazing]);
    expect(terrible.rating).toBe(1.0);
    expect(amazing.rating).toBe(10.0);
  });

  it("leaves unknown positions at baseline", () => {
    const weird = makePlayer("MID");
    (weird.position as string) = "COACH";
    updatePlayerRatings([weird]);
    expect(weird.rating).toBe(6.0);
  });
});

describe("updateTeamRatings", () => {
  function makeTeams(n: number): Team[] {
    return Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `T${i + 1}`, rating: 6 }));
  }

  it("resets to 6.0 for teams with no completed matches", () => {
    const teams = makeTeams(2);
    teams[0]!.rating = 9.9;
    updateTeamRatings(teams, [], []);
    expect(teams[0]!.rating).toBe(6.0);
    expect(teams[1]!.rating).toBe(6.0);
  });

  function neutralSquad(teamId: number): Player[] {
    // one average-rated player so the squad blend contributes exactly zero
    return [makePlayer("MID", { teamId, rating: 6 })];
  }

  it("rewards wins over draws and losses symmetrically", () => {
    const teams = makeTeams(2);
    const matches: Match[] = [
      { id: 1, round: 1, homeId: 1, awayId: 2, homeScore: 3, awayScore: 0, status: "completed", date: "", time: "", venue: "", events: [] },
    ];
    updateTeamRatings(teams, matches, [...neutralSquad(1), ...neutralSquad(2)]);
    const winner = teams[0]!;
    const loser = teams[1]!;
    expect(winner.rating).toBeGreaterThan(loser.rating);

    // winner: 6 + 0.3; loser clamped at the 6.0 floor
    expect(winner.rating).toBeCloseTo(6.3, 5);
    expect(loser.rating).toBe(6.0);
  });

  it("counts a draw as a small positive bump", () => {
    const teams = makeTeams(2);
    const matches: Match[] = [
      { id: 1, round: 1, homeId: 1, awayId: 2, homeScore: 1, awayScore: 1, status: "completed", date: "", time: "", venue: "", events: [] },
    ];
    updateTeamRatings(teams, matches, [...neutralSquad(1), ...neutralSquad(2)]);
    expect(teams[0]!.rating).toBeCloseTo(6.1, 5);
  });

  it("documents the empty-squad handicap: fallback avg of 1.0 drags ratings by -0.5", () => {
    // CURRENT BEHAVIOR — if this starts failing after changing the fallback
    // to 6.0 in ratings.ts, update this test (the change is desirable).
    const teams = makeTeams(2);
    const matches: Match[] = [
      { id: 1, round: 1, homeId: 1, awayId: 2, homeScore: 3, awayScore: 0, status: "completed", date: "", time: "", venue: "", events: [] },
    ];
    updateTeamRatings(teams, matches, []);
    // winner: max(6, 6 + 0.3 + (1-6)*0.1) = max(6, 5.8) = 6.0 — identical to loser
    expect(teams[0]!.rating).toBe(6.0);
    expect(teams[1]!.rating).toBe(6.0);
  });

  it("blends in average squad rating at 10% weight and clamps to [6,10]", () => {
    const teams = makeTeams(2);
    const star = makePlayer("ATT", { teamId: 1, rating: 10 });
    const matches: Match[] = [
      { id: 1, round: 1, homeId: 1, awayId: 2, homeScore: 5, awayScore: 0, status: "completed", date: "", time: "", venue: "", events: [] },
    ];
    updateTeamRatings(teams, matches, [star]);
    // 6 + 0.3 + (10-6)*0.1 = 6.7
    expect(teams[0]!.rating).toBeCloseTo(6.7, 5);
  });

  it("ignores scheduled/live matches entirely", () => {
    const teams = makeTeams(2);
    const matches: Match[] = [
      { id: 1, round: 1, homeId: 1, awayId: 2, homeScore: 9, awayScore: 0, status: "live", date: "", time: "", venue: "", events: [] },
      { id: 2, round: 2, homeId: 1, awayId: 2, homeScore: 9, awayScore: 0, status: "scheduled", date: "", time: "", venue: "", events: [] },
    ];
    updateTeamRatings(teams, matches, []);
    expect(teams.map((t) => t.rating)).toEqual([6, 6]);
  });
});
