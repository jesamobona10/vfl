import { describe, expect, it } from "vitest";
import {
  resolveChampion,
  resolveCupChampion,
  resolveLeagueChampion,
} from "@/lib/celebration/winner";
import type { StandingRow } from "@/lib/types";

function standing(overrides: Partial<StandingRow> = {}): StandingRow {
  return {
    id: 1,
    name: "Alpha FC",
    rating: 1500,
    played: 6,
    won: 4,
    drawn: 2,
    lost: 0,
    gf: 12,
    ga: 4,
    gd: 8,
    points: 14,
    form: "WWDWW",
    ...overrides,
  };
}

describe("resolveLeagueChampion", () => {
  it("returns null until every fixture is completed", () => {
    expect(
      resolveLeagueChampion({
        competitionName: "Premier League",
        seasonName: "2025/26",
        standings: [standing()],
        fixturesCompleted: 5,
        fixturesTotal: 6,
      })
    ).toBeNull();
  });

  it("returns null when the season has no fixtures", () => {
    expect(
      resolveLeagueChampion({
        competitionName: "Premier League",
        standings: [standing()],
        fixturesCompleted: 0,
        fixturesTotal: 0,
      })
    ).toBeNull();
  });

  it("returns null when there are no standings rows", () => {
    expect(
      resolveLeagueChampion({
        competitionName: "Premier League",
        standings: [],
        fixturesCompleted: 6,
        fixturesTotal: 6,
      })
    ).toBeNull();
  });

  it("crowns the top standing once the season is complete", () => {
    const champion = resolveLeagueChampion({
      competitionName: "Premier League",
      seasonName: "2025/26",
      standings: [standing(), standing({ id: 2, name: "Beta FC", points: 10 })],
      fixturesCompleted: 6,
      fixturesTotal: 6,
    });
    expect(champion).not.toBeNull();
    expect(champion!.teamId).toBe(1);
    expect(champion!.name).toBe("Alpha FC");
    expect(champion!.subtitle).toBe("2025/26 · Champions");
    expect(champion!.detail).toContain("14 pts");
    expect(champion!.detail).toContain("+8 GD");
  });

  it("formats a negative goal difference without a plus sign", () => {
    const champion = resolveLeagueChampion({
      competitionName: "League",
      standings: [standing({ gd: -3 })],
      fixturesCompleted: 6,
      fixturesTotal: 6,
    });
    expect(champion!.detail).toContain("-3 GD");
  });
});

describe("resolveCupChampion", () => {
  it("returns null without a champion team id", () => {
    expect(
      resolveCupChampion({
        competitionName: "FA Cup",
        championTeamId: null,
        teams: [{ id: 1, name: "Alpha FC" }],
      })
    ).toBeNull();
  });

  it("returns null when the champion id is unknown", () => {
    expect(
      resolveCupChampion({
        competitionName: "FA Cup",
        championTeamId: 99,
        teams: [{ id: 1, name: "Alpha FC" }],
      })
    ).toBeNull();
  });

  it("crowns the matching team", () => {
    const champion = resolveCupChampion({
      competitionName: "FA Cup",
      seasonName: "2025/26",
      championTeamId: 2,
      teams: [
        { id: 1, name: "Alpha FC" },
        { id: 2, name: "Beta FC", logo_url: "https://example.com/b.png" },
      ],
    });
    expect(champion!.name).toBe("Beta FC");
    expect(champion!.subtitle).toBe("2025/26 · Cup Winners");
    expect(champion!.logoUrl).toBe("https://example.com/b.png");
  });
});

describe("resolveChampion", () => {
  it("dispatches cup inputs", () => {
    const champion = resolveChampion({
      competitionName: "FA Cup",
      championTeamId: 1,
      teams: [{ id: 1, name: "Alpha FC" }],
    });
    expect(champion?.name).toBe("Alpha FC");
  });

  it("dispatches league inputs", () => {
    const champion = resolveChampion({
      competitionName: "League",
      standings: [standing()],
      fixturesCompleted: 6,
      fixturesTotal: 6,
    });
    expect(champion?.name).toBe("Alpha FC");
  });
});
