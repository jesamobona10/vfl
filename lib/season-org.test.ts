import { describe, expect, it, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureCurrentOrgSeason } from "./season-org";

interface State {
  named: Record<string, { id: string } | null>;
  current: { id: string } | null;
  recent: { id: string } | null;
  inserted: string;
  updates: Record<string, unknown>[];
  inserts: Record<string, unknown>[];
}

function fakeClient(state: State): SupabaseClient {
  const client = {
    from: () => {
      let sawOrder = false;
      let nameEq: string | null = null;
      let isCurrentEq: unknown = null;
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (col: string, val: unknown) => {
          if (col === "name") nameEq = val as string;
          if (col === "is_current") isCurrentEq = val;
          return builder;
        },
        order: () => {
          sawOrder = true;
          return builder;
        },
        limit: () => builder,
        update: (payload: Record<string, unknown>) => {
          state.updates.push(payload);
          return builder;
        },
        insert: (payload: Record<string, unknown>) => {
          state.inserts.push(payload);
          return builder;
        },
        single: () => Promise.resolve({ data: { id: state.inserted }, error: null }),
        maybeSingle: () => {
          if (nameEq !== null) {
            return Promise.resolve({ data: state.named[nameEq] ?? null, error: null });
          }
          if (isCurrentEq !== null) {
            return Promise.resolve({ data: state.current, error: null });
          }
          return Promise.resolve({ data: sawOrder ? state.recent : state.current, error: null });
        },
      };
      return builder;
    },
  };
  return client as unknown as SupabaseClient;
}

function freshState(): State {
  return { named: {}, current: null, recent: null, inserted: "created-1", updates: [], inserts: [] };
}

describe("ensureCurrentOrgSeason", () => {
  let state: State;
  beforeEach(() => {
    state = freshState();
  });

  it("returns the existing current org-season without writing", async () => {
    state.current = { id: "cur-1" };
    const id = await ensureCurrentOrgSeason(fakeClient(state), "org-1");
    expect(id).toBe("cur-1");
    expect(state.updates).toEqual([]);
    expect(state.inserts).toEqual([]);
  });

  it("promotes the most recent org-season when none is current", async () => {
    state.recent = { id: "rec-1" };
    const id = await ensureCurrentOrgSeason(fakeClient(state), "org-1");
    expect(id).toBe("rec-1");
    expect(state.updates).toEqual([{ is_current: true }]);
    expect(state.inserts).toEqual([]);
  });

  it("creates a default current org-season when none exists", async () => {
    const id = await ensureCurrentOrgSeason(fakeClient(state), "org-1");
    expect(id).toBe("created-1");
    expect(state.inserts).toHaveLength(1);
    expect(state.inserts[0]).toMatchObject({
      organization_id: "org-1",
      status: "active",
      is_current: true,
    });
  });

  it("uses the preferred name when creating a default org-season", async () => {
    await ensureCurrentOrgSeason(fakeClient(state), "org-1", "2025/2026");
    expect(state.inserts[0].name).toBe("2025/2026");
    expect(state.inserts[0]).toMatchObject({ status: "active", is_current: true });
  });

  it("reuses an org-season that already matches the given name", async () => {
    state.named = { "2026/2027": { id: "named-1" } };
    const id = await ensureCurrentOrgSeason(fakeClient(state), "org-1", "2026/2027");
    expect(id).toBe("named-1");
    expect(state.inserts).toEqual([]);
    expect(state.updates).toEqual([]);
  });

  it("creates the named org-season even when a different season is current", async () => {
    // Regression: a named season must not collapse into the org's current
    // season. It is created as a separate, non-current "upcoming" row.
    state.current = { id: "cur-1" };
    const id = await ensureCurrentOrgSeason(fakeClient(state), "org-1", "2026/2027");
    expect(id).toBe("created-1");
    expect(state.inserts).toHaveLength(1);
    expect(state.inserts[0]).toMatchObject({
      organization_id: "org-1",
      name: "2026/2027",
      status: "upcoming",
      is_current: false,
    });
  });
});
