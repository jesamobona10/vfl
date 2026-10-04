import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const LAYOUT = join(ROOT, "app/org/[slug]/layout.tsx");

/**
 * The coach nav is hand-maintained, and the migration deliberately omits
 * destinations that have no page yet (Lineup, Transfers, team-scoped General
 * Statistics). Adding an entry before the page lands ships a link that either
 * 404s or renders an empty shell, so the two lists are asserted to agree.
 */
function readNavByRole(): Record<string, string[]> {
  const source = readFileSync(LAYOUT, "utf8");
  const block = source.match(/const NAV_BY_ROLE[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!block) throw new Error("NAV_BY_ROLE not found in app/org/[slug]/layout.tsx");

  const nav: Record<string, string[]> = {};
  for (const m of block[1].matchAll(/(\w+):\s*\[([^\]]*)\]/g)) {
    nav[m[1]] = [...m[2].matchAll(/"(\/[^"]*)"/g)].map((h) => h[1]);
  }
  return nav;
}

function readTabs(): string[] {
  const source = readFileSync(LAYOUT, "utf8");
  const block = source.match(/const tabs[^=]*=\s*\[([\s\S]*?)\n\];/);
  if (!block) throw new Error("tabs not found in app/org/[slug]/layout.tsx");
  return [...block[1].matchAll(/href:\s*"(\/[^"]*)"/g)].map((h) => h[1]);
}

describe("coach nav audit", () => {
  const nav = readNavByRole();
  const tabs = readTabs();

  it("parses the nav tables", () => {
    expect(Object.keys(nav)).toContain("team_account");
    expect(tabs.length).toBeGreaterThan(0);
  });

  it.each(Object.keys(nav))("%s only lists entries declared in tabs", (role) => {
    expect(nav[role].filter((h) => !tabs.includes(h))).toEqual([]);
  });

  it.each(Object.keys(nav))("%s nav entries all resolve to a real page", (role) => {
    const missing = nav[role].filter(
      (href) => !existsSync(join(ROOT, "app/org/[slug]", href.replace(/^\//, ""), "page.tsx"))
    );
    expect(missing).toEqual([]);
  });

  it("gives team accounts only the destinations Phase 3a wires up", () => {
    // Anything added here needs a page AND an authorization path before a coach
    // can use it — see the guardrail in the implementation guide.
    expect(nav.team_account).toEqual([
      "/dashboard",
      "/standings",
      "/players",
      "/fixtures",
      "/team-settings",
      "/public",
    ]);
  });

  it("does not expose admin-only destinations to coaches", () => {
    const adminOnly = ["/teams", "/team-accounts", "/competitions", "/audit-logs"];
    expect(nav.team_account.filter((h) => adminOnly.includes(h))).toEqual([]);
  });
});
