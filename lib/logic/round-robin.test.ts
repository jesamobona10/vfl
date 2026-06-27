import { describe, expect, it } from "vitest";
import { generateRoundRobinFixtures } from "./round-robin";

describe("generateRoundRobinFixtures", () => {
  it("generates a complete round-robin schedule for 4 teams", () => {
    const teams = [
      { id: 1, name: "Alpha" },
      { id: 2, name: "Bravo" },
      { id: 3, name: "Charlie" },
      { id: 4, name: "Delta" },
    ];

    const rounds = generateRoundRobinFixtures(teams);
    const matches = rounds.flatMap((round) => round.matches);
    const uniquePairs = new Set(
      matches.map((match) => [match.homeId, match.awayId].sort((a, b) => a - b).join("-"))
    );

    expect(rounds).toHaveLength(3);
    expect(matches).toHaveLength(6);
    expect(uniquePairs.size).toBe(6);
    rounds.forEach((round) => {
      expect(round.matches).toHaveLength(2);
    });
  });

  it("rejects duplicate team names case-insensitively", () => {
    expect(() =>
      generateRoundRobinFixtures([
        { id: 1, name: "Alpha" },
        { id: 2, name: "alpha" },
      ])
    ).toThrow("Team names must be unique before generating fixtures.");
  });
});
