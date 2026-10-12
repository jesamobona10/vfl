import { describe, expect, it } from "vitest";
import { registeredPlayersStartError, teamsWithNoRegisteredPlayers } from "@/lib/match-guard";

const OPTS = {
  homeTeamId: 1,
  awayTeamId: 2,
  homeTeamName: "Kingdom FC",
  awayTeamName: "United Stars",
};

describe("teamsWithNoRegisteredPlayers", () => {
  it("returns neither team when both have players", () => {
    expect(teamsWithNoRegisteredPlayers({ ...OPTS, counts: { 1: 5, 2: 3 } })).toEqual([]);
  });

  it("flags the home team when it has none", () => {
    expect(teamsWithNoRegisteredPlayers({ ...OPTS, counts: { 1: 0, 2: 3 } })).toEqual([
      "Kingdom FC",
    ]);
  });

  it("flags the away team when it has none", () => {
    expect(teamsWithNoRegisteredPlayers({ ...OPTS, counts: { 1: 2, 2: 0 } })).toEqual([
      "United Stars",
    ]);
  });

  it("flags both teams when the fixture has no known registration context", () => {
    expect(teamsWithNoRegisteredPlayers({ ...OPTS, counts: {} })).toEqual([
      "Kingdom FC",
      "United Stars",
    ]);
  });
});

describe("registeredPlayersStartError", () => {
  it("returns null when both teams can play", () => {
    expect(registeredPlayersStartError({ ...OPTS, counts: { 1: 1, 2: 1 } })).toBeNull();
  });

  it("names the single missing team", () => {
    expect(registeredPlayersStartError({ ...OPTS, counts: { 1: 11, 2: 0 } })).toBe(
      "Match can't start — United Stars has no registered players yet."
    );
  });

  it("names both teams when neither is registered", () => {
    expect(registeredPlayersStartError({ ...OPTS, counts: { 1: 0, 2: 0 } })).toBe(
      "Match can't start — Kingdom FC and United Stars have no registered players yet."
    );
  });
});