import { describe, expect, it } from "vitest";
import { parseTeamInviteCSV, sanitizeCsvCell } from "@/lib/utils/csv";

describe("sanitizeCsvCell", () => {
  it.each([
    ["=cmd|'/c calc'!A0", "'=cmd|'/c calc'!A0"],
    ["+SUM(A1)", "'+SUM(A1)"],
    ["-1", "'-1"],
    ["@import", "'@import"],
  ])("neutralizes dangerous formula prefix: %s", (input, expected) => {
    expect(sanitizeCsvCell(input)).toBe(expected);
  });

  it("leaves ordinary text untouched", () => {
    expect(sanitizeCsvCell("John O'Brien")).toBe("John O'Brien");
    expect(sanitizeCsvCell("Team 4")).toBe("Team 4");
    expect(sanitizeCsvCell("goal, assist")).toBe("goal, assist");
  });

  it("only quotes the leading character, not inner ones", () => {
    expect(sanitizeCsvCell("score=2")).toBe("score=2");
    expect(sanitizeCsvCell("a+b-c")).toBe("a+b-c");
  });

  it("handles empty strings", () => {
    expect(sanitizeCsvCell("")).toBe("");
  });
});

describe("parseTeamInviteCSV", () => {
  it("parses email, team and role, defaulting the role to coach", () => {
    const result = parseTeamInviteCSV(
      "email,team,role\ncoach@example.com,Northside Rovers,coach\nasst@example.com,Northside Rovers,assistant_coach\n"
    );
    expect(result.rows).toEqual([
      { email: "coach@example.com", team_name: "Northside Rovers", role: "coach" },
      { email: "asst@example.com", team_name: "Northside Rovers", role: "assistant_coach" },
    ]);
    expect(result.errors).toEqual([]);
  });

  it("normalizes role aliases and casing", () => {
    const result = parseTeamInviteCSV(
      "email,team,role\nA@Example.com,T1,Manager\nb@example.com,T1,Head Coach\nc@example.com,T1,Asst\n"
    );
    expect(result.rows.map((r) => r.role)).toEqual(["coach", "coach", "assistant_coach"]);
    expect(result.rows.map((r) => r.email)).toEqual([
      "a@example.com",
      "b@example.com",
      "c@example.com",
    ]);
  });

  it("requires email and team columns", () => {
    expect(() => parseTeamInviteCSV("team,role\nT1,coach\na@b.com,T1,coach\n")).toThrow(/email/i);
    expect(() => parseTeamInviteCSV("email,role\na@b.com,coach\n")).toThrow(/team/i);
  });

  it("rejects malformed emails and empty teams per row", () => {
    const result = parseTeamInviteCSV(
      "email,team\nnot-an-email,T1\nok@example.com,\n\nreal@example.com,T1\n"
    );
    expect(result.rows).toEqual([{ email: "real@example.com", team_name: "T1", role: "coach" }]);
    expect(result.errors).toHaveLength(2);
  });

  it("skips a repeated address in the same file", () => {
    const result = parseTeamInviteCSV(
      "email,team\ndup@example.com,T1\ndup@example.com,T2\n"
    );
    expect(result.rows).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/duplicate/i);
  });

  it("throws on a header-only file", () => {
    expect(() => parseTeamInviteCSV("email,team\n")).toThrow(/empty|no data rows/i);
  });
});
