import { describe, expect, it, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureCurrentOrgSeason } from "./season-org";

interface State {
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
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
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
        maybeSingle: () =>
          Promise.resolve({ data: sawOrder ? state.recent : state.current, error: null }),
      };
      return builder;
    },
  };
  return client as unknown as SupabaseClient;
}

function freshState(): State {
  return { current: null, recent: null, inserted: "created-1", updates: [], inserts: [] };
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
  });
});
