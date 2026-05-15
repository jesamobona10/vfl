import type { StateCreator } from "zustand";
import type { TeamAccount, UserProfile } from "../types";

export interface AuthSlice {
  currentTeamAccount: TeamAccount | null;
  isAdmin: boolean;
  userProfile: UserProfile | null;
  authLoading: boolean;
  teamDataLoaded: boolean;

  isTeamAccount: () => boolean;
  getManagedTeamId: () => number | null;
  initializeAuth: () => Promise<void>;
  loginAdmin: (email: string, password: string) => Promise<{ error?: string }>;
  loginTeamAccount: (username: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  setTeamDataLoaded: (v: boolean) => void;
}

export const createAuthSlice: StateCreator<any, [], [], AuthSlice> = (set, get) => ({
  currentTeamAccount: null,
  isAdmin: false,
  userProfile: null,
  authLoading: true,
  teamDataLoaded: false,

  isTeamAccount: () => get().currentTeamAccount !== null,

  getManagedTeamId: () => get().currentTeamAccount?.teamId || null,

  initializeAuth: async () => {
    try {
      const res = await fetch("/api/auth/session");
      if (!res.ok) {
        set({ authLoading: false });
        return;
      }
      const data = await res.json();

      if (data.role === "super_admin") {
        set({
          isAdmin: true,
          currentTeamAccount: null,
          userProfile: data.profile,
          authLoading: false,
        });
      } else if (data.role === "team_account") {
        set({
          isAdmin: false,
          currentTeamAccount: {
            id: data.profile.id,
            teamId: data.profile.teamId,
            name: data.profile.displayName || "",
            role: "coach",
            username: data.profile.username || "",
            password: "",
          },
          userProfile: data.profile,
          authLoading: false,
        });
      } else {
        set({ authLoading: false });
      }
    } catch {
      set({ authLoading: false });
    }
  },

  loginAdmin: async (email, password) => {
    try {
      const res = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.error) return { error: data.error };
      set({
        isAdmin: true,
        currentTeamAccount: null,
        userProfile: { id: data.user.id, role: "super_admin", displayName: data.user.email },
      });
      return {};
    } catch {
      return { error: "Connection error. Please try again." };
    }
  },

  loginTeamAccount: async (username, password) => {
    try {
      const res = await fetch("/api/auth/team-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.error) return { error: data.error };
      const account: TeamAccount = {
        id: data.user.id,
        teamId: data.user.teamId,
        name: data.user.displayName,
        role: "coach",
        username: data.user.username,
        password: "",
      };
      set({
        currentTeamAccount: account,
        isAdmin: false,
        userProfile: {
          id: data.user.id,
          role: "team_account",
          displayName: data.user.displayName,
          teamId: data.user.teamId,
          username: data.user.username,
        },
      });
      return {};
    } catch {
      return { error: "Connection error. Please try again." };
    }
  },

  logout: async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    set({ currentTeamAccount: null, isAdmin: false, userProfile: null, teamDataLoaded: false });
  },

  setTeamDataLoaded: (v) => set({ teamDataLoaded: v }),
});
