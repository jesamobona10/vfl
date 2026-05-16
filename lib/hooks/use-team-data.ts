import { useAppStore } from "@/lib/store";

export async function refreshTeamData(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/team/data");
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error || "Failed to fetch team data." };
    }
    const data = await res.json();
    const store = useAppStore.getState();
    store.setTeams(data.teams || []);
    store.setPlayers(data.players || []);
    store.setFixtures(data.fixtures || []);
    store.setTeamDataLoaded(true);
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error fetching team data." };
  }
}

export async function refreshAdminData(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/admin/data");
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error || "Failed to fetch admin data." };
    }
    const data = await res.json();
    const store = useAppStore.getState();
    store.setTeams(data.teams || []);
    store.setPlayers(data.players || []);
    store.setFixtures(data.fixtures || []);
    store.setTeamDataLoaded(true);
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error fetching admin data." };
  }
}
