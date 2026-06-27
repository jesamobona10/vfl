import { describe, expect, it } from "vitest";
import { calculateStandings, leagueStats } from "./standings";
import type { FixtureRound, Team } from "../types";

const teams: Team[] = [
  { id: 1, name: "Alpha", rating: 6 },
  { id: 2, name: "Bravo", rating: 6 },
  { id: 3, name: "Charlie", rating: 6 },
];

const fixtures: FixtureRound[] = [
  {
    round: 1,
    byeId: 3,
    matches: [
      {
        id: 1,
        round: 1,
        homeId: 1,
        awayId: 2,
        homeScore: 2,
        awayScore: 0,
        status: "completed",
        date: "2026-01-01",
        time: "10:00",
        venue: "Main",
        events: [],
      },
    ],
  },
  {
    round: 2,
    byeId: null,
    matches: [
      {
        id: 2,
        round: 2,
        homeId: 2,
        awayId: 3,
        homeScore: 1,
        awayScore: 1,
        status: "completed",
        date: "2026-01-08",
        time: "10:00",
        venue: "Main",
        events: [],
      },
      {
        id: 3,
        round: 2,
        homeId: 1,
        awayId: 3,
        homeScore: null,
        awayScore: null,
        status: "scheduled",
        date: "",
        time: "",
        venue: "",
        events: [],
      },
    ],
  },
];

describe("calculateStandings", () => {
  it("calculates points and sort order from completed matches only", () => {
    const table = calculateStandings(teams, fixtures);
    expect(table.map((row) => row.name)).toEqual(["Alpha", "Charlie", "Bravo"]);
    expect(table.find((row) => row.id === 1)).toMatchObject({
      points: 3,
      won: 1,
      played: 1,
      gd: 2,
    });
    expect(table.find((row) => row.id === 2)).toMatchObject({
      points: 1,
      played: 2,
      lost: 1,
    });
  });
});

describe("leagueStats", () => {
  it("returns aggregate stats from completed fixtures", () => {
    const stats = leagueStats(teams, fixtures);
    expect(stats).toMatchObject({
      goals: 4,
      goalsPerMatch: "2.00",
      biggestWin: "Alpha by 2",
      highestRound: "Round 1 (2)",
    });
  });
});
