import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "@/lib/store";

describe("app store reset", () => {
  beforeEach(() => {
    useAppStore.getState().resetAll();
  });

  it("reverts custom data back to the store defaults", () => {
    const store = useAppStore.getState();
    store.setTeams([{ id: 1, name: "Kingdom FC" } as never]);
    store.setFixtures([{ id: 1, matches: [] } as never]);
    store.setPlayers([{ id: 1, name: "A. Player" } as never]);

    expect(useAppStore.getState().teams).toEqual([{ id: 1, name: "Kingdom FC" }]);
    expect(useAppStore.getState().fixtures).toHaveLength(1);
    expect(useAppStore.getState().players).toHaveLength(1);

    useAppStore.getState().resetAll();

    const after = useAppStore.getState();
    // The teams slice seeds a fixed demo league, so a reset returns to that
    // league rather than emptying the list; the key guarantee is that a
    // previous user's custom teams never leak to the next session.
    expect(after.teams.map((t) => t.name)).not.toContain("Kingdom FC");
    expect(after.teams).toHaveLength(11);
    expect(after.fixtures).toEqual([]);
    expect(after.players).toEqual([]);
    expect(after.cup).toEqual({
      matches: [],
      champion: null,
      playoffsGenerated: false,
      bracketGenerated: false,
    });
  });

  it("clears session and org state on reset", () => {
    const store = useAppStore.getState();
    store.setCurrentOrg({ id: "org-1", name: "VFL", slug: "vfl", type: "school" } as never);
    useAppStore.setState({ userProfile: { id: "u1", role: "org_admin" } as never, isAdmin: true });

    useAppStore.getState().resetAll();

    const after = useAppStore.getState();
    expect(after.userProfile).toBeNull();
    expect(after.isAdmin).toBe(false);
    expect(after.currentOrg).toBeNull();
    expect(after.myOrgs).toEqual([]);
  });
});