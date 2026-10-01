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
 *
 * Scope: this covers a specific set of regressions that have actually shipped
 * in this codebase. It is not a general overflow proof -- it cannot see tables
 * rendered through a component, non-table overflow (wide `pre`, flex rows
 * without `min-w-0`, fixed-size inline SVG), or anything dynamic at runtime.
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
 * Top-level keys of a named object literal in tailwind.config.ts, e.g. the
 * colour families under `colors: { ... }`.
 *
 * Tracks brace depth rather than indentation: an earlier version matched six
 * leading spaces and silently returned an empty set, since the config indents
 * families eight. Re-indenting the config must not change the answer.
 */
function topLevelKeysOf(source: string, objectName: string): Set<string> {
  const start = source.indexOf(`${objectName}: {`);
  if (start === -1) throw new Error(`tailwind.config.ts has no \`${objectName}\` block`);

  const keys = new Set<string>();
  let depth = 0;
  const body = source.slice(start + objectName.length + 1);

  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//")) continue;

    // Depth 1 keys are direct children, so a nested `500:` is not a family.
    if (depth === 1) {
      const key = trimmed.match(/^([a-zA-Z][a-zA-Z0-9-]*):/);
      if (key) keys.add(key[1]);
    }

    for (const char of line) {
      if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
    }
    if (depth === 0) break;
  }

  return keys;
}

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

/**
 * Lines above a `<table>` to inspect for a wrapper or card fallback. Wide
 * enough for a wrapper div plus the props of the elements between them.
 *
 * Known limitation: this is a line window, not a parsed ancestor chain, so a
 * scroller less than this many lines above an unhandled table still excuses it.
 * It fixes the failure that actually occurs in practice -- an unrelated
 * scroller hundreds of lines away in the same file -- without pulling in a JSX
 * parser. Tighten the window if a future case needs it.
 */
const TABLE_CONTEXT_LINES = 6;

/** Whether the table on `lineIndex` has a scroll wrapper or mobile card fallback. */
function hasMobileTreatment(lines: string[], lineIndex: number): boolean {
  const context = lines
    .slice(Math.max(0, lineIndex - TABLE_CONTEXT_LINES), lineIndex + 1)
    .join("\n");
  return (
    /overflow-x-auto/.test(context) ||
    /<DataTable/.test(context) ||
    /lg:hidden/.test(context) ||
    /min-w-\[\d+px\]/.test(context)
  );
}

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

  it("parses the theme colours out of tailwind.config.ts", () => {
    // Guards the palette rule below: if the parse silently returns nothing,
    // every foreign palette would be reported forever and the rule would be
    // deleted as noise rather than fixed.
    const config = readFileSync(join(ROOT, "tailwind.config.ts"), "utf8");
    const defined = topLevelKeysOf(config, "colors");

    expect(defined).toContain("brand");
    expect(defined).toContain("danger");
    expect(defined).toContain("ink");
    // Nested shades must not be mistaken for families.
    expect(defined).not.toContain("DEFAULT");
    expect(defined).not.toContain("500");
  });

  it("only uses palettes defined in the Tailwind theme", () => {
    const config = readFileSync(join(ROOT, "tailwind.config.ts"), "utf8");
    const defined = topLevelKeysOf(config, "colors");

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

  it("accepts a foreign palette once it is defined in the theme", () => {
    // The inverse of the rule above, proving the check consults the config
    // rather than rejecting every foreign palette unconditionally.
    const config = readFileSync(join(ROOT, "tailwind.config.ts"), "utf8");
    const defined = topLevelKeysOf(config, "colors");
    expect(defined.has("blue")).toBe(false);

    const patched = config.replace(
      "        gold: {",
      '        blue: {\n          500: "#2563eb",\n        },\n        gold: {'
    );
    expect(topLevelKeysOf(patched, "colors").has("blue")).toBe(true);
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
      const lines = source.split("\n");

      lines.forEach((line, i) => {
        if (!/<table[\s>]/.test(line)) return;

        // Scope the search to this table's own neighbourhood. A file-level check
        // is wrong: one `overflow-x-auto` anywhere would excuse every other
        // table in the file, which is exactly the bug this rule must catch.
        if (!hasMobileTreatment(lines, i)) {
          findings.push(
            `${rel}:${i + 1} <table> has no overflow-x-auto wrapper and no mobile card layout`
          );
        }
      });
    }
    expect(findings).toEqual([]);
  });

  it("does not excuse a table just because the file mentions overflow-x-auto", () => {
    // Guards the scoping of the rule above: an unrelated scroller earlier in the
    // file must not launder a genuinely unhandled table further down.
    const filler = Array.from({ length: TABLE_CONTEXT_LINES }, (_, i) => `const x${i} = ${i};`);
    const source = [
      '<div className="overflow-x-auto"><table className="w-full" /></div>',
      ...filler,
      '<div><table className="w-full" /></div>',
    ].join("\n");
    const lines = source.split("\n");

    expect(hasMobileTreatment(lines, 0)).toBe(true);
    expect(hasMobileTreatment(lines, filler.length + 1)).toBe(false);
  });
});
