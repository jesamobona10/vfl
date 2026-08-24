import { describe, expect, it } from "vitest";
import {
  calculateStandings,
  completedMatches,
  leagueStats,
  standingsMatches,
} from "@/lib/logic/standings";
import type { FixtureRound, Match, Team } from "@/lib/types";

function makeTeams(n: number): Team[] {
  return Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Team ${i + 1}`, rating: 6 }));
}

function match(partial: Partial<Match> & Pick<Match, "id" | "homeId" | "awayId">): Match {
  return {
    round: 1,
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    date: "",
    time: "",
    venue: "",
    events: [],
    ...partial,
  };
}

function fixturesOf(matches: Match[]): FixtureRound[] {
  const byRound = new Map<number, FixtureRound>();
  for (const m of matches) {
    if (!byRound.has(m.round)) byRound.set(m.round, { round: m.round, byeId: null, matches: [] });
    byRound.get(m.round)!.matches.push(m);
  }
  return [...byRound.values()].sort((a, b) => a.round - b.round);
}

describe("match filters", () => {
  it("completedMatches requires integer scores and completed status", () => {
    const fixtures = fixturesOf([
      match({ id: 1, homeId: 1, awayId: 2, status: "completed", homeScore: 2, awayScore: 1 }),
      match({ id: 2, homeId: 2, awayId: 3, status: "completed", homeScore: null, awayScore: null }),
      match({ id: 3, homeId: 1, awayId: 3, status: "scheduled", homeScore: 5, awayScore: 0 }),
    ]);
    expect(completedMatches(fixtures)).toHaveLength(1);
  });

  it("standingsMatches include live/in-progress but not scheduled", () => {
    const fixtures = fixturesOf([
      match({ id: 1, homeId: 1, awayId: 2, status: "live", homeScore: 1, awayScore: 0 }),
      match({ id: 2, homeId: 2, awayId: 3, status: "in-progress", homeScore: null, awayScore: null }),
      match({ id: 3, homeId: 1, awayId: 3, status: "scheduled", homeScore: 9, awayScore: 9 }),
    ]);
    const included = standingsMatches(fixtures);
    expect(included.map((m) => m.id).sort()).toEqual([1, 2]);
  });
});

describe("calculateStandings", () => {
  it("awards 3/1/0 points and computes goal difference", () => {
    const teams = makeTeams(3);
    const fixtures = fixturesOf([
      // A beats B 2-1
      match({ id: 1, round: 1, homeId: 1, awayId: 2, status: "completed", homeScore: 2, awayScore: 1 }),
      // B draws C 0-0
      match({ id: 2, round: 1, homeId: 2, awayId: 3, status: "completed", homeScore: 0, awayScore: 0 }),
    ]);

    const table = calculateStandings(teams, fixtures);
    const byId = new Map(table.map((row) => [row.id, row]));

    const a = byId.get(1)!;
    expect(a.played).toBe(1);
    expect(a.won).toBe(1);
    expect(a.points).toBe(3);
    expect(a.gf).toBe(2);
    expect(a.ga).toBe(1);
    expect(a.gd).toBe(1);

    const b = byId.get(2)!;
    expect(b.played).toBe(2);
    expect(b.won).toBe(0);
    expect(b.drawn).toBe(1);
    expect(b.lost).toBe(1);
    expect(b.points).toBe(1);
    expect(b.gd).toBe(-1);

    const c = byId.get(3)!;
    expect(c.points).toBe(1);
    expect(c.gf).toBe(0);
  });

  it("sorts by points, then goal difference, then goals for, then name", () => {
    const teams = makeTeams(4);
    const fixtures = fixturesOf([
      // B wins big vs D → 3 pts, +4
      match({ id: 1, round: 1, homeId: 2, awayId: 4, status: "completed", homeScore: 5, awayScore: 1 }),
      // A wins narrowly vs C → 3 pts, +1
      match({ id: 2, round: 1, homeId: 1, awayId: 3, status: "completed", homeScore: 2, awayScore: 1 }),
    ]);

    const order = calculateStandings(teams, fixtures).map((row) => row.id);
    expect(order).toEqual([2, 1, 3, 4]); // B first on GD; A second; then C (lost 1-2), D (lost 1-5)
  });

  it("ignores matches between teams missing from the table", () => {
    const teams = makeTeams(2); // only teams 1 and 2 exist
    const fixtures = fixturesOf([
      match({ id: 1, homeId: 1, awayId: 99, status: "completed", homeScore: 3, awayScore: 0 }),
    ]);
    const table = calculateStandings(teams, fixtures);
    expect(table.every((row) => row.played === 0)).toBe(true);
  });
});

describe("leagueStats", () => {
  it("sums goals and names the biggest win and highest-scoring round", () => {
    const teams = makeTeams(4);
    const fixtures = fixturesOf([
      match({ id: 1, round: 1, homeId: 1, awayId: 2, status: "completed", homeScore: 4, awayScore: 0 }),
      match({ id: 2, round: 1, homeId: 3, awayId: 4, status: "completed", homeScore: 1, awayScore: 1 }),
      match({ id: 3, round: 2, homeId: 1, awayId: 3, status: "completed", homeScore: 0, awayScore: 2 }),
      match({ id: 4, round: 2, homeId: 2, awayId: 4, status: "scheduled", homeScore: 7, awayScore: 7 }),
    ]);

    const stats = leagueStats(teams, fixtures);
    expect(stats.goals).toBe(8); // only completed matches count
    expect(stats.goalsPerMatch).toBe("2.67"); // 8 goals over 3 completed
    expect(stats.biggestWin).toBe("Team 1 by 4");
    expect(stats.highestRound).toBe("Round 1 (6)");
  });

  it("returns placeholders for an empty season", () => {
    const stats = leagueStats(makeTeams(4), []);
    expect(stats.goals).toBe(0);
    expect(stats.goalsPerMatch).toBe("0.00");
    expect(stats.biggestWin).toBe("None");
    expect(stats.highestRound).toBe("None");
  });
});
