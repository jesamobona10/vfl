/**
 * Match flyer configuration model.
 *
 * Flyer settings live under `competitions.settings.flyer` (a free-form JSONB
 * blob). This module is the single source of truth for the shape, defaults and
 * sanitization so the settings UI, the flyer renderer and the API all agree —
 * and so nothing unvalidated reaches the database or the canvas.
 */

export const FLYER_TEMPLATES = ["classic", "minimal", "bold"] as const;
export type FlyerTemplate = (typeof FLYER_TEMPLATES)[number];

export const FLYER_FORMATS = ["portrait", "square", "story"] as const;
export type FlyerFormat = (typeof FLYER_FORMATS)[number];

export interface FlyerFormatSpec {
  id: FlyerFormat;
  label: string;
  /** CSS pixel size of the rendered canvas (exported at 3x). */
  width: number;
  height: number;
}

export const FLYER_FORMAT_SPECS: Record<FlyerFormat, FlyerFormatSpec> = {
  portrait: { id: "portrait", label: "Portrait", width: 390, height: 520 },
  square: { id: "square", label: "Square", width: 420, height: 420 },
  story: { id: "story", label: "Story", width: 360, height: 640 },
};

export const FLYER_TEMPLATE_OPTIONS: { id: FlyerTemplate; label: string; description: string }[] = [
  { id: "classic", label: "Classic", description: "Branded header with a centered layout" },
  { id: "minimal", label: "Minimal", description: "Clean, light and left-aligned" },
  { id: "bold", label: "Bold", description: "Large type on a solid colour block" },
];

export interface FlyerSettings {
  /** Full-bleed background image URL, or null for the built-in designs. */
  background_url: string | null;
  /** Text colour used over a custom background. */
  text_color: string;
  /** Accent colour used by the built-in templates. */
  accent_color: string;
  template: FlyerTemplate;
  format: FlyerFormat;
  /** Small label above the teams (e.g. "Match Day"). */
  headline: string;
  /** Optional line under the headline. */
  subtitle: string;
  show_logos: boolean;
  show_venue: boolean;
  show_competition: boolean;
  /** Dark scrim opacity (0-100) applied over a custom background. */
  overlay: number;
  /** Optional footer line (sponsor, hashtag, ...). */
  footer_text: string;
}

export const DEFAULT_FLYER_SETTINGS: FlyerSettings = {
  background_url: null,
  text_color: "#ffffff",
  accent_color: "#0f7c45",
  template: "classic",
  format: "portrait",
  headline: "Match Day",
  subtitle: "",
  show_logos: true,
  show_venue: true,
  show_competition: true,
  overlay: 45,
  footer_text: "",
};

const MAX_URL_LENGTH = 2048;
const MAX_HEADLINE = 60;
const MAX_SUBTITLE = 80;
const MAX_FOOTER = 80;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}

export function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function text(value: unknown, max: number, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * Coerce unknown input (from JSONB or the settings form) into a safe
 * `FlyerSettings`. Unknown keys are dropped; invalid values fall back to the
 * defaults so a bad payload can never break rendering.
 */
export function parseFlyerSettings(raw: unknown): FlyerSettings {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_FLYER_SETTINGS };
  }
  const input = raw as Record<string, unknown>;

  const background =
    typeof input.background_url === "string" && input.background_url.trim()
      ? input.background_url.trim().slice(0, MAX_URL_LENGTH)
      : null;

  const template = FLYER_TEMPLATES.includes(input.template as FlyerTemplate)
    ? (input.template as FlyerTemplate)
    : DEFAULT_FLYER_SETTINGS.template;

  const format = FLYER_FORMATS.includes(input.format as FlyerFormat)
    ? (input.format as FlyerFormat)
    : DEFAULT_FLYER_SETTINGS.format;

  const overlay =
    typeof input.overlay === "number"
      ? clampNumber(input.overlay, 0, 100)
      : DEFAULT_FLYER_SETTINGS.overlay;

  return {
    background_url: background,
    text_color: isHexColor(input.text_color)
      ? input.text_color
      : DEFAULT_FLYER_SETTINGS.text_color,
    accent_color: isHexColor(input.accent_color)
      ? input.accent_color
      : DEFAULT_FLYER_SETTINGS.accent_color,
    template,
    format,
    headline: text(input.headline, MAX_HEADLINE, DEFAULT_FLYER_SETTINGS.headline),
    subtitle: text(input.subtitle, MAX_SUBTITLE, ""),
    show_logos: bool(input.show_logos, DEFAULT_FLYER_SETTINGS.show_logos),
    show_venue: bool(input.show_venue, DEFAULT_FLYER_SETTINGS.show_venue),
    show_competition: bool(input.show_competition, DEFAULT_FLYER_SETTINGS.show_competition),
    overlay,
    footer_text: text(input.footer_text, MAX_FOOTER, ""),
  };
}

/** Read flyer settings out of a competition's `settings` object. */
export function readFlyerSettings(settings: unknown): FlyerSettings {
  if (settings === null || typeof settings !== "object" || Array.isArray(settings)) {
    return { ...DEFAULT_FLYER_SETTINGS };
  }
  return parseFlyerSettings((settings as Record<string, unknown>).flyer);
}

/** True when the settings differ from the defaults (used to show "customised"). */
export function hasCustomFlyerSettings(settings: FlyerSettings): boolean {
  const d = DEFAULT_FLYER_SETTINGS;
  return (
    settings.background_url !== d.background_url ||
    settings.text_color !== d.text_color ||
    settings.accent_color !== d.accent_color ||
    settings.template !== d.template ||
    settings.format !== d.format ||
    settings.headline !== d.headline ||
    settings.subtitle !== d.subtitle ||
    settings.show_logos !== d.show_logos ||
    settings.show_venue !== d.show_venue ||
    settings.show_competition !== d.show_competition ||
    settings.overlay !== d.overlay ||
    settings.footer_text !== d.footer_text
  );
}
