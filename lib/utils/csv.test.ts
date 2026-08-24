import { describe, expect, it } from "vitest";
import { sanitizeCsvCell } from "@/lib/utils/csv";

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
