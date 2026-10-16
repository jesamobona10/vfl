import { describe, expect, it } from "vitest";
import {
  ALL_EVENT_TYPES,
  EVENT_CATEGORIES,
  eventTypeAbbr,
  eventTypeLabel,
  isEventType,
  primaryEventTypes,
  scoreDelta,
  SCORING_EVENT_TYPES,
  secondaryEventTypes,
} from "./events";

describe("event vocabulary", () => {
  it("has no duplicate event types across categories", () => {
    const seen = new Set<string>();
    for (const type of ALL_EVENT_TYPES) {
      expect(seen.has(type)).toBe(false);
      seen.add(type);
    }
  });

  it("splits primary and secondary types without overlap or loss", () => {
    for (const type of primaryEventTypes) expect(secondaryEventTypes).not.toContain(type);
    expect([...primaryEventTypes, ...secondaryEventTypes].sort()).toEqual(
      [...ALL_EVENT_TYPES].sort()
    );
  });

  it("only marks goal types as unscored-complement (scoring set)", () => {
    expect(SCORING_EVENT_TYPES).toEqual(["goal", "own-goal"]);
  });

  it("labels and abbreviates known types, falling back to the raw value", () => {
    expect(eventTypeLabel("goal")).toBe("Goal");
    expect(eventTypeAbbr("own-goal")).toBe("OG");
    expect(eventTypeLabel("mystery")).toBe("mystery");
    expect(eventTypeAbbr("mystery")).toBe("MYSTERY");
  });

  it("recognises valid event types only", () => {
    expect(isEventType("goal")).toBe(true);
    expect(isEventType("mystery")).toBe(false);
  });

  it("keeps every category populated", () => {
    for (const category of EVENT_CATEGORIES) {
      expect(category.types.length).toBeGreaterThan(0);
    }
  });
});

describe("scoreDelta", () => {
  const home = 1;
  const away = 2;

  it("credits the scoring player's own side for a goal", () => {
    expect(scoreDelta("goal", home, home, away)).toEqual({ home: 1, away: 0 });
    expect(scoreDelta("goal", away, home, away)).toEqual({ home: 0, away: 1 });
  });

  it("credits the opponent for an own goal", () => {
    expect(scoreDelta("own-goal", home, home, away)).toEqual({ home: 0, away: 1 });
    expect(scoreDelta("own-goal", away, home, away)).toEqual({ home: 1, away: 0 });
  });

  it("ignores non-scoring events", () => {
    expect(scoreDelta("yellow", home, home, away)).toEqual({ home: 0, away: 0 });
    expect(scoreDelta("assist", away, home, away)).toEqual({ home: 0, away: 0 });
  });

  it("ignores a scoring event from a player not on either side", () => {
    expect(scoreDelta("goal", 99, home, away)).toEqual({ home: 0, away: 0 });
  });
});
