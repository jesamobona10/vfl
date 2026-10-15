import { describe, expect, it } from "vitest";
import { computeEventScore, EVENT_STAT_FIELD } from "@/lib/match-events";
import type { Match } from "@/lib/types";

function match(overrides: Partial<Match> = {}): Match {
  return {
    id: 1,
    round: 1,
    homeId: 10,
    awayId: 20,
    homeScore: 0,
    awayScore: 0,
    status: "live",
    date: "",
    time: "",
    venue: "",
    events: [],
    ...overrides,
  };
}

describe("computeEventScore", () => {
  it("credits a home goal to the home side", () => {
    expect(computeEventScore(match(), 10, "goal")).toEqual({ homeScore: 1, awayScore: 0 });
  });

  it("credits an away goal to the away side", () => {
    expect(computeEventScore(match(), 20, "goal")).toEqual({ homeScore: 0, awayScore: 1 });
  });

  it("awards an own goal to the opposing team", () => {
    // Home player scores into their own net → away team gains.
    expect(computeEventScore(match(), 10, "own-goal")).toEqual({ homeScore: 0, awayScore: 1 });
    expect(computeEventScore(match(), 20, "own-goal")).toEqual({ homeScore: 1, awayScore: 0 });
  });

  it("leaves the score untouched for non-scoring events", () => {
    expect(computeEventScore(match(), 10, "yellow")).toEqual({ homeScore: 0, awayScore: 0 });
    expect(computeEventScore(match(), 20, "assist")).toEqual({ homeScore: 0, awayScore: 0 });
  });

  it("treats a null score as zero", () => {
    expect(computeEventScore(match({ homeScore: null, awayScore: null }), 10, "goal")).toEqual({
      homeScore: 1,
      awayScore: 0,
    });
  });
});

describe("EVENT_STAT_FIELD", () => {
  it("maps goal and discipline events to their stat columns", () => {
    expect(EVENT_STAT_FIELD.goal).toBe("goals");
    expect(EVENT_STAT_FIELD.assist).toBe("assists");
    expect(EVENT_STAT_FIELD.yellow).toBe("yellowCards");
    expect(EVENT_STAT_FIELD.red).toBe("redCards");
    expect(EVENT_STAT_FIELD["own-goal"]).toBe("ownGoals");
  });
});
