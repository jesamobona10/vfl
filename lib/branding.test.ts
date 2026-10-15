import { describe, it, expect } from "vitest";
import {
  normalizeHex,
  contrastRatio,
  readableForeground,
  rgbChannels,
  validateBrandColor,
  brandStyleVars,
} from "./branding";

describe("normalizeHex", () => {
  it("normalizes six-digit hex with or without a leading hash", () => {
    expect(normalizeHex("#0F7C45")).toBe("#0f7c45");
    expect(normalizeHex("0f7c45")).toBe("#0f7c45");
    expect(normalizeHex("  #0F7C45  ")).toBe("#0f7c45");
  });

  it("expands three-digit shorthand", () => {
    expect(normalizeHex("#abc")).toBe("#aabbcc");
    expect(normalizeHex("f00")).toBe("#ff0000");
  });

  it("rejects non-hex input", () => {
    expect(normalizeHex("rebeccapurple")).toBeNull();
    expect(normalizeHex("#12")).toBeNull();
    expect(normalizeHex("#gggggg")).toBeNull();
    expect(normalizeHex(123)).toBeNull();
    expect(normalizeHex(null)).toBeNull();
    expect(normalizeHex(undefined)).toBeNull();
  });
});

describe("contrastRatio", () => {
  it("returns 21 for black on white and 1 for a color on itself", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#0f7c45", "#0f7c45")).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#0f7c45", "#ffffff")).toBeCloseTo(
      contrastRatio("#ffffff", "#0f7c45"),
      5
    );
  });
});

describe("readableForeground", () => {
  it("picks white on a dark color", () => {
    expect(readableForeground("#0f7c45")).toBe("#ffffff");
  });

  it("picks near-black on a light color", () => {
    expect(readableForeground("#ffe680")).toBe("#101010");
  });
});

describe("validateBrandColor", () => {
  it("accepts the default brand and derives a palette", () => {
    const result = validateBrandColor("#0f7c45");
    expect(result.ok).toBe(true);
    expect(result.palette?.base).toBe("#0f7c45");
    expect(result.palette?.baseRgb).toBe("15 124 69");
    expect(result.palette?.foreground).toBe("#ffffff");
    expect(result.palette?.dark).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("picks an ink foreground for a light but acceptable color", () => {
    const result = validateBrandColor("#ffe680");
    expect(result.ok).toBe(true);
    expect(result.palette?.foreground).toBe("#101010");
  });

  it("rejects a mid-tone that is unreadable with either foreground", () => {
    const result = validateBrandColor("#797979");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/readable/i);
  });

  it("rejects invalid hex", () => {
    const result = validateBrandColor("nope");
    expect(result.ok).toBe(false);
    expect(result.palette).toBeUndefined();
  });
});

describe("brandStyleVars", () => {
  it("returns variable overrides for a valid color", () => {
    const vars = brandStyleVars("#0f7c45");
    expect(vars["--brand-600-rgb"]).toBe("15 124 69");
    expect(vars["--brand-foreground"]).toBe("#ffffff");
    expect(vars["--brand-50-rgb"]).toBeDefined();
  });

  it("returns no overrides for unset or invalid colors", () => {
    expect(brandStyleVars(null)).toEqual({});
    expect(brandStyleVars("")).toEqual({});
    expect(brandStyleVars("not-a-color")).toEqual({});
  });
});

describe("rgbChannels", () => {
  it("formats channels as space-separated numbers", () => {
    expect(rgbChannels("#ffffff")).toBe("255 255 255");
    expect(rgbChannels("#000000")).toBe("0 0 0");
  });
});
