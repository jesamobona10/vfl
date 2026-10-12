import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const API = join(process.cwd(), "app/api");

function walkRoutes(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkRoutes(full));
    else if (st.isFile() && name === "route.ts") out.push(full);
  }
  return out;
}

const routeName = (file: string) =>
  file.slice(API.length).replace(/\\/g, "/").replace(/\/route\.ts$/, "") || "/";

/**
 * Routes that must always be reachable without an account, by design. Anything
 * not listed here must carry an authorization guard, so adding a new unguarded
 * route fails this audit and forces an explicit decision.
 */
const PUBLIC_DESIGN = [
  "/auth/admin-login",
  "/auth/admin-signup",
  "/auth/change-password",
  "/auth/forgot-password",
  "/auth/logout",
  "/auth/org-login",
  "/auth/player-login",
  "/auth/player-register",
  "/auth/reset-password",
  "/auth/session",
  "/auth/team-login",
  "/cron/pre-match-reminders",
  "/org/register",
  "/public/live",
  "/public/matches/[id]/halftime",
  "/public/push-subscriptions",
];

const FILES = walkRoutes(API);

/** Any evidence that the route gates access on an account or ownership. */
const GUARDED_RE =
  /requireOrgOwner\b|requireOrgAdmin\b|requireOrgMember\b|requireAuth\b|requireAdmin\b|ownsTeam\b|createApiHandler\b|auth\s*:\s*"[a-z_]+"|orgMembership\b|isAdmin\b|if\s*\(\s*!auth\b/;

/** Super-admin only. */
const ADMIN_GUARD_RE = /requireAdmin\b|auth\s*:\s*"admin"/;

/**
 * Org-admin or better. Accepts the two-step `requireOrgAdmin(auth, orgId)`
 * guard as well as the inline owner/admin membership-role check that resolves
 * the org by slug before comparing (e.g. /organizations/[slug]/generate-fixtures).
 */
const ORG_ADMIN_GUARD_RE =
  /requireOrgAdmin\b|requireOrgOwner\b|\["owner",\s*"admin"\]/;

/** Mutations that must never accept a merely authenticated member. */
const SENSITIVE_MUTATIONS = [
  "/competitions/[id]",
  "/competitions/[id]/generate-fixtures",
  "/competitions/[id]/seasons",
  "/competitions/[id]/seasons/rollover",
  "/events/[id]",
  "/fixtures/[id]/events",
  "/fixtures/[id]/report/analyze",
  "/fixtures/[id]/report/analyses/[analysisId]",
  "/fixtures/[id]/report/analyses/[analysisId]/confirm",
  "/fixtures/[id]/start",
  "/organizations/[slug]/competitions/[cId]/fixtures",
  "/organizations/[slug]/delete-fixtures",
  "/organizations/[slug]/generate-fixtures",
  "/organizations/[slug]",
  "/organizations/[slug]/players/import",
  "/org/members",
  "/org/[slug]",
  "/org/team-accounts",
  "/org/team-accounts/[id]",
  "/players/[id]",
  "/players/[id]/anonymize",
  "/seasons/[id]",
  "/seasons/[id]/fixtures",
  "/seasons/[id]/teams/[seasonTeamId]",
  "/seasons/[id]/teams/[seasonTeamId]/players",
  "/sync/fixtures",
  "/upload/comp-logo",
  "/upload/flyer-bg",
  "/upload/logo",
  "/upload/org-logo",
];

const srcOf = (file: string) => readFileSync(file, "utf8");

describe("API authorization matrix", () => {
  it("every non-public route enforces an account or ownership guard", () => {
    for (const file of FILES) {
      const route = routeName(file);
      if (PUBLIC_DESIGN.includes(route)) continue;
      expect(GUARDED_RE.test(srcOf(file)), `${route} has no authorization guard`).toBe(true);
    }
  });

  it("admin routes are super-admin only", () => {
    for (const file of FILES) {
      const route = routeName(file);
      if (!route.startsWith("/admin")) continue;
      expect(ADMIN_GUARD_RE.test(srcOf(file)), `${route} must be admin-only`).toBe(true);
    }
  });

  it("sensitive mutations require org-admin (or owner) access", () => {
    for (const route of SENSITIVE_MUTATIONS) {
      const file = FILES.find((f) => routeName(f) === route);
      expect(file, `${route} route file not found — matrix entry may be stale`).toBeDefined();
      expect(
        ORG_ADMIN_GUARD_RE.test(srcOf(file!)),
        `${route} must require org admin/owner, not any member`
      ).toBe(true);
    }
  });

  it("public-by-design routes actually exist", () => {
    const names = new Set(FILES.map(routeName));
    for (const route of PUBLIC_DESIGN) {
      expect(names.has(route), `public route ${route} no longer exists — update the list`).toBe(
        true
      );
    }
  });
});