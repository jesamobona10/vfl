import { describe, expect, it } from "vitest";
import type { Match } from "@/lib/types";
import { fixtureMatchesMatchdayView, getMatchdayViewCounts } from "./matchday";

function match(overrides: Partial<Match>): Match {
  return {
    id: 1,
    round: 1,
    homeId: 10,
    awayId: 20,
    homeScore: null,
    awayScore: null,
    status: "scheduled",
    date: "2026-10-26",
    time: "14:00",
    venue: "School Stadium",
    events: [],
    ...overrides,
  };
}

describe("matchday view classification", () => {
  const today = "2026-10-26";

  it("keeps incomplete scheduled fixtures in Needs action, not Upcoming", () => {
    const incomplete = match({ id: 1, venue: "" });
    expect(fixtureMatchesMatchdayView(incomplete, "needs_action", today)).toBe(true);
    expect(fixtureMatchesMatchdayView(incomplete, "upcoming", today)).toBe(false);
  });

  it("classifies live and completed matches by lifecycle status", () => {
    expect(fixtureMatchesMatchdayView(match({ status: "live" }), "live", today)).toBe(true);
    expect(fixtureMatchesMatchdayView(match({ status: "completed" }), "completed", today)).toBe(true);
  });

  it("counts a match in every applicable view", () => {
    const matches = [match({ id: 1 }), match({ id: 2, status: "live" }), match({ id: 3, status: "completed", date: "2026-10-25" })];
    expect(getMatchdayViewCounts(matches, today)).toEqual({
      today: 2,
      live: 1,
      needs_action: 0,
      upcoming: 1,
      completed: 1,
    });
  });
});
