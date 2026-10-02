import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Every competition season must carry `organization_season_id`.
 *
 * Without that link the season is invisible to season-scoped reads
 * (`resolveOrgSeasonIds`, `/api/organizations/[slug]/fixtures?org_season_id=`),
 * so the org dashboard reports an empty season even though teams and fixtures
 * exist inside one of the org's competitions.
 */
const ROOT = join(__dirname, "..");
const API_DIR = join(ROOT, "app", "api");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry === "route.ts") out.push(full);
  }
  return out;
}

/** The object literal passed to a `.from("seasons").insert({ ... })` call. */
function seasonInsertBodies(source: string): string[] {
  return [...source.matchAll(/\.from\("seasons"\)\s*\.insert\(\{([\s\S]*?)\}\)/g)].map((m) => m[1]);
}

const ROUTES = walk(API_DIR);

describe("season inserts are linked to an org season", () => {
  it("finds season inserts to check", () => {
    const total = ROUTES.reduce(
      (n, file) => n + seasonInsertBodies(readFileSync(file, "utf8")).length,
      0
    );
    expect(total).toBeGreaterThan(0);
  });

  it("sets organization_season_id on every season insert", () => {
    const offenders: string[] = [];

    for (const file of ROUTES) {
      const rel = relative(ROOT, file);
      seasonInsertBodies(readFileSync(file, "utf8")).forEach((body) => {
        if (!body.includes("organization_season_id")) offenders.push(rel);
      });
    }

    expect(offenders).toEqual([]);
  });
});
