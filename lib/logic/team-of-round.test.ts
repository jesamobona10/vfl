import { describe, expect, it } from "vitest";
import {
  buildTeamOfRound,
  computeRoundPlayerStats,
  isRoundComplete,
  normalizePosition,
  playerOfRoundGate,
  scoreRoundPlayer,
  selectPlayerOfRound,
  selectTeamOfRound,
  summarizeRounds,
  type RoundFixtureInput,
  type RoundLineupInput,
  type RoundPlayerInput,
  type RoundTeamInput,
  type TeamOfRoundInput,
} from "@/lib/logic/team-of-round";
import type { PlayerPosition, RoundAwardPlayer } from "@/lib/types";

const TEAMS: RoundTeamInput[] = [
  { id: 1, name: "Alpha", logo: null },
  { id: 2, name: "Beta", logo: null },
];

function makePlayer(
  id: number,
  teamId: number,
  position: string | null,
  name = `Player ${id}`
): RoundPlayerInput {
  return { id, name, teamId, position, photoUrl: null };
}

function fixture(overrides: Partial<RoundFixtureInput> = {}): RoundFixtureInput {
  return {
    id: 1,
    homeTeamId: 1,
    awayTeamId: 2,
    homeScore: 2,
    awayScore: 0,
    status: "completed",
    ...overrides,
  };
}

function starters(ids: number[], fixtureId = 1, teamId = 1): RoundLineupInput {
  return { fixtureId, teamId, starterIds: ids };
}

function makeStats(
  position: PlayerPosition,
  overrides: Partial<RoundAwardPlayer> = {}
): RoundAwardPlayer {
  return {
    playerId: 1,
    name: "Test Player",
    teamId: 1,
    teamName: "Alpha",
    teamLogo: null,
    photoUrl: null,
    position,
    impact: 0,
    appearances: 1,
    goals: 0,
    assists: 0,
    ownGoals: 0,
    saves: 0,
    penaltySaves: 0,
    fivePlusSaves: false,
    cleanSheets: 0,
    goalsConceded: 0,
    tackles: 0,
    interceptions: 0,
    blocks: 0,
    aerialsWon: 0,
    errors: 0,
    penaltiesConceded: 0,
    yellowCards: 0,
    redCards: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    motm: 0,
    ...overrides,
  };
}

describe("normalizePosition", () => {
  it("maps common position labels into the four award groups", () => {
    expect(normalizePosition("Goalkeeper")).toBe("GK");
    expect(normalizePosition("CB")).toBe("DEF");
    expect(normalizePosition("Left Back")).toBe("DEF");
    expect(normalizePosition("Wing Back")).toBe("DEF");
    expect(normalizePosition("Holding Midfielder")).toBe("MID");
    expect(normalizePosition("Winger")).toBe("ATT");
    expect(normalizePosition("Right Wing")).toBe("ATT");
    expect(normalizePosition(null)).toBe("MID");
  });
});

describe("isRoundComplete", () => {
  it("requires a result and no pending match", () => {
    expect(isRoundComplete(["completed", "cancelled"])).toBe(true);
    expect(isRoundComplete(["finished", "postponed"])).toBe(true);
    expect(isRoundComplete(["completed", "live"])).toBe(false);
    expect(isRoundComplete(["completed", "scheduled"])).toBe(false);
    expect(isRoundComplete(["cancelled"])).toBe(false);
  });
});

describe("summarizeRounds", () => {
  it("groups fixtures and reports completion per round", () => {
    const rounds = summarizeRounds([
      { round: 1, status: "completed" },
      { round: 1, status: "completed" },
      { round: 2, status: "completed" },
      { round: 2, status: "scheduled" },
      { round: 3, status: "cancelled" },
    ]);

    expect(rounds).toEqual([
      { round: 1, matches: 2, completedMatches: 2, complete: true },
      { round: 2, matches: 2, completedMatches: 1, complete: false },
      { round: 3, matches: 1, completedMatches: 0, complete: false },
    ]);
  });
});

describe("computeRoundPlayerStats", () => {
  it("scores a goalkeeper clean sheet, save volume and penalty save", () => {
    const input: TeamOfRoundInput = {
      fixtures: [fixture()],
      events: [
        ...Array.from({ length: 5 }, () => ({
          fixtureId: 1,
          playerId: 1,
          teamId: 1,
          type: "save",
        })),
        { fixtureId: 1, playerId: 1, teamId: 1, type: "penalty-save" },
      ],
      players: [makePlayer(1, 1, "GK")],
      lineups: [starters([1])],
      teams: TEAMS,
    };

    const [keeper] = computeRoundPlayerStats(input);

    expect(keeper.cleanSheets).toBe(1);
    expect(keeper.saves).toBe(5);
    expect(keeper.penaltySaves).toBe(1);
    expect(keeper.fivePlusSaves).toBe(true);
    expect(keeper.impact).toBe(22);
  });

  it("normalises legacy event names", () => {
    const input: TeamOfRoundInput = {
      fixtures: [fixture({ homeScore: 1, awayScore: 1 })],
      events: [
        { fixtureId: 1, playerId: 1, teamId: 1, type: "penalty_goal" },
        { fixtureId: 1, playerId: 1, teamId: 1, type: "own_goal" },
        { fixtureId: 1, playerId: 1, teamId: 1, type: "yellow_card" },
        { fixtureId: 1, playerId: 1, teamId: 1, type: "penalty_save" },
      ],
      players: [makePlayer(1, 1, "MID")],
      lineups: [starters([1])],
      teams: TEAMS,
    };

    const [player] = computeRoundPlayerStats(input);

    expect(player.goals).toBe(1);
    expect(player.ownGoals).toBe(1);
    expect(player.yellowCards).toBe(1);
    expect(player.penaltySaves).toBe(1);
  });

  it("credits clean sheets only to goalkeepers and defenders", () => {
    const input: TeamOfRoundInput = {
      fixtures: [fixture({ homeScore: 0, awayScore: 0 })],
      events: [],
      players: [
        makePlayer(1, 1, "GK"),
        makePlayer(2, 1, "DEF"),
        makePlayer(3, 1, "MID"),
        makePlayer(4, 1, "ATT"),
      ],
      lineups: [starters([1, 2, 3, 4])],
      teams: TEAMS,
    };

    const byId = new Map(computeRoundPlayerStats(input).map((player) => [player.playerId, player]));

    expect(byId.get(1)?.cleanSheets).toBe(1);
    expect(byId.get(2)?.cleanSheets).toBe(1);
    expect(byId.get(3)?.cleanSheets).toBe(0);
    expect(byId.get(4)?.cleanSheets).toBe(0);
  });

  it("does not credit a clean sheet when the team concedes", () => {
    const input: TeamOfRoundInput = {
      fixtures: [fixture({ homeScore: 2, awayScore: 1 })],
      events: [],
      players: [makePlayer(1, 1, "GK"), makePlayer(2, 1, "DEF")],
      lineups: [starters([1, 2])],
      teams: TEAMS,
    };

    const byId = new Map(computeRoundPlayerStats(input).map((player) => [player.playerId, player]));

    expect(byId.get(1)?.cleanSheets).toBe(0);
    expect(byId.get(2)?.cleanSheets).toBe(0);
    expect(byId.get(1)?.goalsConceded).toBe(1);
  });
});

describe("scoreRoundPlayer", () => {
  it("uses position-specific weights", () => {
    const defender = makeStats("DEF", { cleanSheets: 1, tackles: 4, wins: 1 });
    expect(scoreRoundPlayer(defender)).toBe(8.3);

    const forward = makeStats("ATT", { goals: 2, wins: 1 });
    expect(scoreRoundPlayer(forward)).toBeCloseTo(13.5, 5);
  });
});

describe("selectTeamOfRound", () => {
  it("builds a 4-3-3 and flags a fallback out of position", () => {
    const players = [
      makePlayer(1, 1, "GK"),
      makePlayer(2, 1, "DEF"),
      makePlayer(3, 1, "DEF"),
      makePlayer(4, 1, "DEF"),
      makePlayer(5, 1, "DEF"),
      makePlayer(6, 1, "MID"),
      makePlayer(7, 1, "MID"),
      makePlayer(8, 1, "ATT"),
      makePlayer(9, 1, "ATT"),
      makePlayer(10, 1, "ATT"),
      makePlayer(11, 1, "ATT"),
    ];

    const stats = computeRoundPlayerStats({
      fixtures: [fixture({ homeScore: 0, awayScore: 0 })],
      events: [],
      players,
      lineups: [starters(players.map((player) => player.id))],
      teams: TEAMS,
    });

    const team = selectTeamOfRound(stats);

    expect(team).toHaveLength(11);
    expect(team.filter((entry) => entry.slot === "GK")).toHaveLength(1);
    expect(team.filter((entry) => entry.slot === "DEF")).toHaveLength(4);
    expect(team.filter((entry) => entry.slot === "MID")).toHaveLength(3);
    expect(team.filter((entry) => entry.slot === "ATT")).toHaveLength(3);
    expect(team.filter((entry) => entry.outOfPosition)).toHaveLength(1);
    expect(team.find((entry) => entry.outOfPosition)?.player.position).toBe("ATT");
  });
});

describe("playerOfRoundGate", () => {
  it("applies each position's criteria", () => {
    expect(playerOfRoundGate(makeStats("GK", { saves: 5 })).qualifies).toBe(true);
    expect(playerOfRoundGate(makeStats("GK", { cleanSheets: 1 })).qualifies).toBe(false);
    expect(playerOfRoundGate(makeStats("DEF", { cleanSheets: 1, tackles: 4 })).qualifies).toBe(
      true
    );
    expect(playerOfRoundGate(makeStats("DEF", { goals: 2 })).qualifies).toBe(true);
    expect(playerOfRoundGate(makeStats("MID", { goals: 1, tackles: 3 })).qualifies).toBe(true);
    expect(playerOfRoundGate(makeStats("MID", { assists: 2 })).qualifies).toBe(true);
    expect(playerOfRoundGate(makeStats("ATT", { goals: 1 })).qualifies).toBe(true);
    expect(playerOfRoundGate(makeStats("ATT", { assists: 1 })).qualifies).toBe(false);
  });

  it("disqualifies a player who was sent off", () => {
    expect(playerOfRoundGate(makeStats("ATT", { goals: 1, redCards: 1 })).qualifies).toBe(false);
  });
});

describe("selectPlayerOfRound", () => {
  it("returns the highest-impact player who passes the gate", () => {
    const winner = selectPlayerOfRound([
      makeStats("ATT", { playerId: 1, goals: 1, impact: 6 }),
      makeStats("ATT", { playerId: 2, goals: 1, assists: 1, impact: 9.5 }),
      makeStats("ATT", { playerId: 3, assists: 1, impact: 3.5 }),
    ]);

    expect(winner?.player.playerId).toBe(2);
    expect(winner?.criteria).toContain("Scored a goal");
  });

  it("returns null when nobody qualifies", () => {
    expect(selectPlayerOfRound([makeStats("ATT", { assists: 1, impact: 3.5 })])).toBeNull();
  });
});

describe("buildTeamOfRound", () => {
  it("forces the Player of the Round into the XI", () => {
    const players = [
      makePlayer(1, 1, "GK"),
      makePlayer(2, 1, "DEF"),
      makePlayer(3, 1, "DEF"),
      makePlayer(4, 1, "DEF"),
      makePlayer(5, 1, "DEF"),
      makePlayer(6, 1, "MID"),
      makePlayer(7, 1, "MID"),
      makePlayer(8, 1, "MID"),
      makePlayer(9, 1, "MID"),
      makePlayer(10, 1, "ATT"),
      makePlayer(11, 1, "ATT"),
      makePlayer(12, 1, "ATT"),
    ];

    const tackleEvents = [6, 7, 8].flatMap((playerId) =>
      Array.from({ length: 20 }, () => ({
        fixtureId: 1,
        playerId,
        teamId: 1,
        type: "tackle",
      }))
    );

    const result = buildTeamOfRound({
      fixtures: [fixture()],
      events: [
        ...tackleEvents,
        { fixtureId: 1, playerId: 9, teamId: 1, type: "goal" },
        ...Array.from({ length: 3 }, () => ({
          fixtureId: 1,
          playerId: 9,
          teamId: 1,
          type: "tackle",
        })),
      ],
      players,
      lineups: [starters(players.map((player) => player.id))],
      teams: TEAMS,
    });

    expect(result.playerOfRound?.player.playerId).toBe(9);
    const selected = result.team.find((entry) => entry.player.playerId === 9);
    expect(selected).toBeDefined();
    expect(selected?.slot).toBe("MID");
    expect(selected?.outOfPosition).toBe(false);
    expect(result.team).toHaveLength(11);
  });
});
