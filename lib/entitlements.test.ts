import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  entitlements: [] as Array<{
    org_season_id: string | null;
    status: string;
    starts_at: string | null;
    ends_at: string | null;
  }>,
  error: null as { message: string } | null,
  seasonsById: {} as Record<string, { organization_season_id: string | null }>,
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: (_column: string, value: string) => {
          if (table === "season_entitlements") {
            return Promise.resolve({ data: h.entitlements, error: h.error });
          }
          const season = h.seasonsById[value] ?? null;
          return { maybeSingle: () => Promise.resolve({ data: season, error: null }) };
        },
      }),
    }),
  }),
}));

import {
  canManageSeason,
  requireSeasonEntitlement,
  requireSeasonEntitlementForCompetitionSeason,
} from "./entitlements";

beforeEach(() => {
  h.entitlements = [];
  h.error = null;
  h.seasonsById = {};
});

describe("canManageSeason", () => {
  it("allows writes when no entitlement exists (grandfathered)", async () => {
    expect(await canManageSeason("org-1")).toBe(true);
    expect(await canManageSeason("org-1", "season-1")).toBe(true);
  });

  it("allows writes for an active, in-window entitlement", async () => {
    h.entitlements = [
      { org_season_id: null, status: "active", starts_at: null, ends_at: null },
    ];
    expect(await canManageSeason("org-1")).toBe(true);
  });

  it("blocks writes for an expired entitlement but not reads", async () => {
    h.entitlements = [
      { org_season_id: null, status: "expired", starts_at: null, ends_at: null },
    ];
    expect(await canManageSeason("org-1")).toBe(false);
  });

  it("blocks writes when the window has passed", async () => {
    h.entitlements = [
      {
        org_season_id: null,
        status: "active",
        starts_at: null,
        ends_at: new Date(Date.now() - 86_400_000).toISOString(),
      },
    ];
    expect(await canManageSeason("org-1")).toBe(false);
  });

  it("blocks writes when the window has not started", async () => {
    h.entitlements = [
      {
        org_season_id: null,
        status: "active",
        starts_at: new Date(Date.now() + 86_400_000).toISOString(),
        ends_at: null,
      },
    ];
    expect(await canManageSeason("org-1")).toBe(false);
  });

  it("prefers a season-scoped entitlement over the org-wide one", async () => {
    h.entitlements = [
      { org_season_id: null, status: "expired", starts_at: null, ends_at: null },
      { org_season_id: "season-1", status: "active", starts_at: null, ends_at: null },
    ];
    expect(await canManageSeason("org-1", "season-1")).toBe(true);
    expect(await canManageSeason("org-1", "season-2")).toBe(false);
  });

  it("fails open (allows writes) when the lookup errors", async () => {
    h.error = { message: "relation does not exist" };
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await canManageSeason("org-1")).toBe(true);
    errorSpy.mockRestore();
  });
});

describe("requireSeasonEntitlement", () => {
  it("returns null when the write is allowed", async () => {
    expect(await requireSeasonEntitlement("org-1", "season-1")).toBeNull();
  });

  it("returns a 402 response when blocked", async () => {
    h.entitlements = [
      { org_season_id: "season-1", status: "expired", starts_at: null, ends_at: null },
    ];
    const res = await requireSeasonEntitlement("org-1", "season-1");
    expect(res?.status).toBe(402);
    await expect(res!.json()).resolves.toMatchObject({ error: expect.stringContaining("not active") });
  });
});

describe("requireSeasonEntitlementForCompetitionSeason", () => {
  it("resolves the org season then applies the gate", async () => {
    h.seasonsById = { "comp-season-1": { organization_season_id: "season-1" } };
    h.entitlements = [
      { org_season_id: "season-1", status: "expired", starts_at: null, ends_at: null },
    ];
    const res = await requireSeasonEntitlementForCompetitionSeason("org-1", "comp-season-1");
    expect(res?.status).toBe(402);
  });

  it("falls back to the org-wide entitlement when the season has no org-season", async () => {
    h.seasonsById = { "comp-season-1": { organization_season_id: null } };
    h.entitlements = [
      { org_season_id: null, status: "active", starts_at: null, ends_at: null },
    ];
    expect(await requireSeasonEntitlementForCompetitionSeason("org-1", "comp-season-1")).toBeNull();
  });
});
