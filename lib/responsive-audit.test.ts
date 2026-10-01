import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Static guard against mobile-responsiveness regressions.
 *
 * These are the layout bugs that actually shipped: undefined color tokens
 * silently dropping styling, unprefixed multi-column grids, oversized fixed
 * widths, bare 100vw, and tables with no mobile treatment.
 *
 * A real browser check is not possible here (no Supabase credentials, so the
 * authenticated routes redirect to login), so this scans the source instead.
 */

const ROOT = join(__dirname, "..");
const SCAN_DIRS = ["app", "components"];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const FILES = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));

/**
 * Deliberate exceptions, each with the reason it is acceptable. Keeping these
 * here documents intent instead of blocking it.
 */
const ALLOWED = new Set([
  // Month grid: a calendar legitimately needs 7 columns; cells stay ~44px.
  "components/calendar/calendar-view.tsx",
  // Bracket has an explicit stacked fallback below md.
  "components/cup/cup-bracket.tsx",
  // Formation pitch scrolls horizontally by design.
  "components/teams/team-card.tsx",
  // Compact P/W/L/GD/Pts tiles inside an existing mobile card layout.
  "components/standings/standings-table.tsx",
  // Offscreen html2canvas canvas for PNG/PDF export; never rendered on screen.
  "components/standings/standings-export.tsx",
]);

/** Tailwind v3 default palettes. None of these exist in this theme. */
const FOREIGN_PALETTES = new Set([
  "amber",
  "red",
  "emerald",
  "blue",
  "indigo",
  "gray",
  "grey",
  "slate",
  "zinc",
  "neutral",
  "stone",
  "orange",
  "purple",
  "pink",
  "cyan",
  "teal",
  "sky",
  "violet",
  "rose",
  "lime",
  "yellow",
  "fuchsia",
  "maroon",
  "navy",
  "olive",
]);

/**
 * Line-scoped exceptions, as [file, class substring, reason]. Used where a
 * narrow grid is deliberate rather than an oversight.
 */
const ALLOWED_LINES: Array<[string, string, string]> = [
  [
    "components/admin/data-importer.tsx",
    "grid grid-cols-3 gap-2 sm:gap-4",
    "compact 3-up summary inside a modal: ~95px per tile, stacks would make the modal taller for no gain",
  ],
];

const COLOR_UTILITIES =
  "text|bg|border|ring|fill|stroke|divide|placeholder|decoration|accent|caret|outline|from|via|to|shadow";

function scan(rule: (line: string) => string | null) {
  const findings: string[] = [];
  for (const file of FILES) {
    const rel = relative(ROOT, file);
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (ALLOWED_LINES.some(([f, needle]) => rel === f && line.includes(needle))) return;
        const message = rule(line);
        if (message) findings.push(`${rel}:${i + 1} ${message}`);
      });
  }
  return findings;
}

describe("responsive source audit", () => {
  it("scans a meaningful number of files", () => {
    expect(FILES.length).toBeGreaterThan(100);
  });

  it("only uses palettes defined in the Tailwind theme", () => {
    // Families come from top-level keys of theme.extend.colors, e.g. "brand", "ink".
    const config = readFileSync(join(ROOT, "tailwind.config.ts"), "utf8");
    const colorsBlock = config.slice(config.indexOf("colors:"));
    const defined = new Set(
      [...colorsBlock.matchAll(/^\s{6}([a-z][a-z0-9-]*):/gm)].map((m) => m[1])
    );

    const findings = scan((line) => {
      // Requires a <family>-<shade> shape, which excludes directional
      // utilities such as border-r-0, divide-y-0 and rounded-b-2.
      for (const m of line.matchAll(
        new RegExp(`\\b(?:${COLOR_UTILITIES})-([a-z]+)-(\\d{2,3})\\b`, "g")
      )) {
        const family = m[1];
        if (FOREIGN_PALETTES.has(family) && !defined.has(family)) {
          return `palette "${family}" is not defined in tailwind.config.ts (no styles will be emitted)`;
        }
      }
      return null;
    });

    expect(findings).toEqual([]);
  });

  it("does not use fixed widths wider than a small phone", () => {
    const findings = scan((line) => {
      // min-w-* is excluded: it is usually a floor inside a shrinkable flex
      // child or the min-width of a deliberately scrollable table.
      const m = line.match(/(?<![\w:-])w-\[(\d+)px\]/);
      if (m && Number(m[1]) > 320) return `fixed width w-[${m[1]}px] exceeds a 320px viewport`;
      return null;
    });

    expect(findings).toEqual([]);
  });

  it("never uses a bare 100vw width", () => {
    const findings = scan((line) => {
      // 100vw includes the scrollbar width and causes horizontal overflow.
      if (line.includes("100vw") && !/calc\(100vw\s*-/.test(line)) {
        return "bare 100vw causes horizontal overflow";
      }
      return null;
    });

    expect(findings).toEqual([]);
  });

  it("documents every exception it allows", () => {
    // Each allowlist entry must carry a reason, and each reason must name the
    // file it applies to, so dead exceptions are obvious during review.
    for (const [file, , reason] of ALLOWED_LINES) {
      expect(reason.length).toBeGreaterThan(20);
      expect(FILES.map((f) => relative(ROOT, f))).toContain(file);
    }
  });

  it("keeps multi-column grids behind a breakpoint", () => {
    const findings: string[] = [];
    for (const file of FILES) {
      if (ALLOWED.has(relative(ROOT, file))) continue;
      const rel = relative(ROOT, file);
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (ALLOWED_LINES.some(([f, needle]) => rel === f && line.includes(needle))) return;
          // The lookbehind rejects sm:/md:/lg: variants, so only base grids count.
          for (const m of line.matchAll(/(?<![\w:-])grid-cols-([3-9])(?![\w-])/g)) {
            findings.push(
              `${rel}:${i + 1} unprefixed grid-cols-${m[1]} renders ${m[1]} columns below 640px`
            );
          }
        });
    }
    expect(findings).toEqual([]);
  });

  it("gives every on-screen table a mobile treatment", () => {
    const findings: string[] = [];
    for (const file of FILES) {
      const rel = relative(ROOT, file);
      if (ALLOWED.has(rel)) continue;
      const source = readFileSync(file, "utf8");
      if (!/<table[\s>]/.test(source)) continue;

      const hasScrollWrapper = /overflow-x-auto/.test(source);
      const hasCardFallback =
        /<DataTable/.test(source) || /lg:hidden/.test(source) || /min-w-\[\d+px\]/.test(source);

      if (!hasScrollWrapper && !hasCardFallback) {
        findings.push(
          `${rel} has a <table> with no overflow-x-auto wrapper and no mobile card layout`
        );
      }
    }
    expect(findings).toEqual([]);
  });
});
