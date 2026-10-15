import { describe, it, expect } from "vitest";
import { can, isOrgAdminLike, isTeamAccountLike, type Actor } from "./permissions";

function actor(overrides: Partial<Actor> = {}): Actor {
  return {
    isAdmin: false,
    role: null,
    orgRole: null,
    teamId: null,
    ...overrides,
  };
}

const orgAdmin = actor({ role: "org_admin", orgRole: "admin" });
const orgOwner = actor({ role: "org_admin", orgRole: "owner" });
const coach = actor({ role: "org_admin", orgRole: "coach" });
const teamAccount = actor({ role: "team_account", teamId: 7 });
const player = actor({ role: "player" });
const superAdmin = actor({ isAdmin: true, role: "super_admin" });

describe("isOrgAdminLike", () => {
  it("accepts owners, admins and super admins", () => {
    expect(isOrgAdminLike(orgOwner)).toBe(true);
    expect(isOrgAdminLike(orgAdmin)).toBe(true);
    expect(isOrgAdminLike(superAdmin)).toBe(true);
  });

  it("rejects coaches, players and team accounts", () => {
    expect(isOrgAdminLike(coach)).toBe(false);
    expect(isOrgAdminLike(player)).toBe(false);
    expect(isOrgAdminLike(teamAccount)).toBe(false);
    expect(isOrgAdminLike(actor())).toBe(false);
  });

  it("falls back to the coarse role for legacy sessions without orgRole", () => {
    expect(isOrgAdminLike(actor({ role: "org_admin", orgRole: null }))).toBe(true);
  });
});

describe("isTeamAccountLike", () => {
  it("is true only for team accounts", () => {
    expect(isTeamAccountLike(teamAccount)).toBe(true);
    expect(isTeamAccountLike(orgAdmin)).toBe(false);
    expect(isTeamAccountLike(player)).toBe(false);
  });
});

describe("can", () => {
  const orgAdminActions = [
    "organization.manage",
    "competition.create",
    "competition.delete",
    "competition.manage",
    "fixtures.generate",
    "fixtures.edit",
    "players.manage",
    "teams.manage",
    "teamAccounts.manage",
  ] as const;

  it.each(orgAdminActions)("allows org admins for %s", (action) => {
    expect(can(orgAdmin, action).allowed).toBe(true);
  });

  it("allows super admins every action", () => {
    for (const action of orgAdminActions) {
      expect(can(superAdmin, action).allowed).toBe(true);
    }
    expect(can(superAdmin, "match.edit").allowed).toBe(true);
  });

  it("denies coaches and team accounts the admin-only actions", () => {
    for (const action of orgAdminActions) {
      expect(can(coach, action).allowed).toBe(false);
      expect(can(teamAccount, action).allowed).toBe(false);
    }
  });

  it("allows match.edit for org admins and team accounts, not players", () => {
    expect(can(orgAdmin, "match.edit").allowed).toBe(true);
    expect(can(teamAccount, "match.edit").allowed).toBe(true);
    expect(can(player, "match.edit").allowed).toBe(false);
    expect(can(actor(), "match.edit").allowed).toBe(false);
  });

  it("denies signed-out actors", () => {
    expect(can(actor(), "competition.create").allowed).toBe(false);
    expect(can(actor(), "match.edit").allowed).toBe(false);
  });
});
