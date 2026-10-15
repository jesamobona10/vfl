/**
 * Derive an accessible brand palette from a single accent color.
 *
 * An organization may set one hex color; everything else (a darker hover
 * shade, two tint backgrounds, and a readable foreground for text placed on
 * the brand) is computed here so the console, public pages, flyers and
 * exports all read from the same CSS variables.
 *
 * The palette mirrors the default `--brand-*` variables in app/globals.css so
 * an org color can be injected by simply overriding those variables.
 */

const HEX6 = /^#?([0-9a-fA-F]{6})$/;
const HEX3 = /^#?([0-9a-fA-F]{3})$/;

/** WCAG AA contrast for normal body text. */
const MIN_ON_BRAND_CONTRAST = 4.5;

/** A resolved brand palette ready to be written to CSS variables. */
export interface BrandPalette {
  /** Normalized base color, e.g. `#0f7c45`. */
  base: string;
  /** Base color as space-separated RGB channels (`"15 124 69"`). */
  baseRgb: string;
  /** Darker shade used for hover states. */
  dark: string;
  /** Very light tint, as RGB channels, for subtle backgrounds. */
  tint50Rgb: string;
  /** Light tint, as RGB channels, for stronger backgrounds. */
  tint100Rgb: string;
  /** Text color that reads well on the base color. */
  foreground: string;
}

/** Result of validating/normalizing a candidate brand color. */
export interface BrandValidation {
  ok: boolean;
  /** Human-readable reason when `ok` is false. */
  error?: string;
  /** Derived palette when `ok` is true. */
  palette?: BrandPalette;
}

/**
 * Normalize a hex color to lowercase `#rrggbb`, expanding 3-digit shorthand.
 *
 * @param input - Candidate value, typically from a settings form or the DB.
 * @returns The normalized color, or `null` when the input isn't valid hex.
 */
export function normalizeHex(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  const six = HEX6.exec(value);
  if (six) return `#${six[1].toLowerCase()}`;
  const three = HEX3.exec(value);
  if (three) {
    const [r, g, b] = three[1].toLowerCase().split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return null;
}

/** Split a normalized `#rrggbb` string into `[r, g, b]` channels. */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Relative luminance per WCAG 2.x. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** WCAG contrast ratio between two colors (1..21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Pick the most readable of white/ink for text placed on `background`. */
export function readableForeground(background: string): string {
  const white = contrastRatio("#ffffff", background);
  const ink = contrastRatio("#101010", background);
  return white >= ink ? "#ffffff" : "#101010";
}

/** Scale every channel by `factor` (<1 darkens), clamped to 0..255. */
function shade(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  const scale = (v: number) => Math.max(0, Math.min(255, Math.round(v * factor)));
  return `#${[scale(r), scale(g), scale(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Blend `hex` toward `toward` by `amount` (0..1). */
export function mix(hex: string, toward: string, amount: number): string {
  const [r1, g1, b1] = hexToRgb(hex);
  const [r2, g2, b2] = hexToRgb(toward);
  const blend = (a: number, b: number) =>
    Math.round(a * (1 - amount) + b * amount)
      .toString(16)
      .padStart(2, "0");
  return `#${blend(r1, r2)}${blend(g1, g2)}${blend(b1, b2)}`;
}

/** Space-separated RGB channels for a color, for `rgb(var(--x) / a)` usage. */
export function rgbChannels(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return `${r} ${g} ${b}`;
}

/**
 * Validate a candidate brand color and derive its palette.
 *
 * Rejects anything that isn't hex, and any color that cannot produce readable
 * text on the brand surface (a mid-tone where neither white nor near-black
 * reaches AA). When white is too weak but near-black reads well, near-black is
 * chosen automatically as the foreground.
 *
 * @param input - Candidate value from a form or the database.
 */
export function validateBrandColor(input: unknown): BrandValidation {
  const base = normalizeHex(input);
  if (!base) {
    return { ok: false, error: "Brand color must be a hex color like #0f7c45." };
  }

  const foreground = readableForeground(base);
  if (contrastRatio(foreground, base) < MIN_ON_BRAND_CONTRAST) {
    return {
      ok: false,
      error: "That color can't produce readable text. Pick a darker or lighter shade.",
    };
  }

  return {
    ok: true,
    palette: {
      base,
      baseRgb: rgbChannels(base),
      dark: shade(base, 0.78),
      tint50Rgb: rgbChannels(mix(base, "#ffffff", 0.91)),
      tint100Rgb: rgbChannels(mix(base, "#ffffff", 0.82)),
      foreground,
    },
  };
}

/**
 * Build inline style overrides for the brand CSS variables.
 *
 * Returns an empty object when the color is unset or invalid so the default
 * palette in app/globals.css remains in effect.
 *
 * @param color - The organization's stored `brand_color`, if any.
 */
export function brandStyleVars(color: unknown): Record<string, string> {
  const result = validateBrandColor(color);
  if (!result.ok || !result.palette) return {};
  const p = result.palette;
  return {
    "--brand": p.base,
    "--brand-dark": p.dark,
    "--brand-50-rgb": p.tint50Rgb,
    "--brand-100-rgb": p.tint100Rgb,
    "--brand-500": p.base,
    "--brand-600": p.base,
    "--brand-600-rgb": p.baseRgb,
    "--brand-700": p.dark,
    "--brand-foreground": p.foreground,
  };
}
