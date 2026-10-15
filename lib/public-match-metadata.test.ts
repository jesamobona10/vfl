import { describe, expect, it } from "vitest";
import { buildPublicMatchMetadata } from "./public-match-metadata";
import type { PublicMatchRow } from "./types";

function match(overrides: Partial<PublicMatchRow> = {}): PublicMatchRow {
  return {
    match_id: 42,
    round: 3,
    home_team_name: "North High",
    away_team_name: "South High",
    home_score: 2,
    away_score: 1,
    status: "live",
    date: "2026-05-01",
    time: "15:00",
    venue: "Main Field",
    ...overrides,
  };
}

describe("buildPublicMatchMetadata", () => {
  it("uses the scoreline for live matches", () => {
    const metadata = buildPublicMatchMetadata(match({ status: "live" }));
    expect(metadata.title).toBe("2–1: North High vs South High");
    expect(metadata.openGraph?.title).toBe("North High 2–1 South High");
    expect(String(metadata.description)).toContain("Live score");
  });

  it("uses the scoreline for completed matches", () => {
    const metadata = buildPublicMatchMetadata(match({ status: "completed" }));
    expect(metadata.title).toBe("2–1: North High vs South High");
    expect(String(metadata.description)).toContain("Full-time");
  });

  it("shows the fixture for scheduled matches", () => {
    const metadata = buildPublicMatchMetadata(
      match({ status: "scheduled", home_score: null, away_score: null })
    );
    expect(metadata.title).toBe("North High vs South High");
    expect(metadata.openGraph?.title).toBe("North High vs South High");
    expect(String(metadata.description)).toContain("Main Field");
  });

  it("falls back safely when the match is missing", () => {
    expect(buildPublicMatchMetadata(null)).toEqual({ title: "Live Match" });
  });

  it("never includes player-level data, only team names and score", () => {
    const metadata = buildPublicMatchMetadata(match({ status: "live" }));
    const serialized = JSON.stringify(metadata);
    // The public match row has no player fields; assert the preview text stays
    // team-level so the privacy guardrail holds by construction.
    expect(serialized).not.toMatch(/player/i);
    expect(serialized).not.toContain("photo");
  });
});
