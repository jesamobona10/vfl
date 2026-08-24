import { describeFetchError } from "@/lib/utils/error-message";
import type { StateCreator } from "zustand";
import type { TeamAccount, UserProfile } from "../types";
import type { AppStore } from "./index";

/** Authentication state slice managing login sessions and user profiles. */
export interface AuthSlice {
  /** Current team account session (null if not a team account). */
  currentTeamAccount: TeamAccount | null;
  /** Whether the current user is a super admin. */
  isAdmin: boolean;
  /** Resolved user profile from the session endpoint. */
  userProfile: UserProfile | null;
  /** Whether the initial auth check is still in progress. */
  authLoading: boolean;
  /** Whether team-specific data has been loaded for the current session. */
  teamDataLoaded: boolean;

  /** Returns true if the current session is a team account. */
  isTeamAccount: () => boolean;
  /** Returns the managed team ID for team accounts, or null. */
  getManagedTeamId: () => number | null;
  /** Initializes auth state by fetching the session endpoint. */
  initializeAuth: () => Promise<void>;
  /** Authenticates a super admin via email/password. */
  loginAdmin: (email: string, password: string) => Promise<{ error?: string }>;
  /** Authenticates an organization admin via email/password. */
  loginOrgAdmin: (email: string, password: string) => Promise<{ error?: string; slug?: string }>;
  /** Authenticates a team account via username/password. */
  loginTeamAccount: (
    username: string,
    password: string
  ) => Promise<{ error?: string; slug?: string | null }>;
  /** Authenticates a player via username/password. */
  loginPlayer: (username: string, password: string) => Promise<{ error?: string }>;
  /** Clears the current session and resets auth state. */
  logout: () => Promise<void>;
  /** Sets the teamDataLoaded flag. */
  setTeamDataLoaded: (v: boolean) => void;
}

export const createAuthSlice: StateCreator<AppStore, [], [], AuthSlice> = (set, get) => ({
  currentTeamAccount: null,
  isAdmin: false,
  userProfile: null,
  authLoading: true,
  teamDataLoaded: false,

  isTeamAccount: () => get().currentTeamAccount !== null,

  getManagedTeamId: () => get().currentTeamAccount?.teamId ?? null,

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
          teamDataLoaded: false,
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
          teamDataLoaded: false,
        });
      } else if (data.role === "org_admin") {
        set({
          isAdmin: false,
          currentTeamAccount: null,
          userProfile: data.profile,
          authLoading: false,
          teamDataLoaded: false,
        });
      } else if (data.role === "player") {
        set({
          isAdmin: false,
          currentTeamAccount: null,
          userProfile: data.profile,
          authLoading: false,
          teamDataLoaded: false,
        });
      } else {
        set({ authLoading: false });
      }
    } catch (error) {
      console.error("Auth initialization failed:", error);
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
        teamDataLoaded: false,
      });
      return {};
    } catch (err) {
      return { error: describeFetchError(err, "Connection error. Please try again.") };
    }
  },

  loginOrgAdmin: async (email, password) => {
    try {
      const res = await fetch("/api/auth/org-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.error) return { error: data.error };
      set({
        isAdmin: false,
        currentTeamAccount: null,
        userProfile: {
          id: data.user.id,
          role: "org_admin",
          displayName: data.user.email,
          org: data.user.org,
        },
        teamDataLoaded: false,
      });
      return { slug: data.user.org.slug };
    } catch (err) {
      return { error: describeFetchError(err, "Connection error. Please try again.") };
    }
  },

  loginPlayer: async (username, password) => {
    try {
      const res = await fetch("/api/auth/player-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.error) return { error: data.error };
      set({
        isAdmin: false,
        currentTeamAccount: null,
        teamDataLoaded: false,
        userProfile: {
          id: data.user.id,
          role: "player",
          displayName: data.user.displayName,
          username: data.user.username,
          playerId: data.user.playerId,
        },
      });
      return {};
    } catch (err) {
      return { error: describeFetchError(err, "Connection error. Please try again.") };
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
        teamDataLoaded: false,
        userProfile: {
          id: data.user.id,
          role: "team_account",
          displayName: data.user.displayName,
          teamId: data.user.teamId,
          username: data.user.username,
          orgSlug: data.user.orgSlug,
        },
      });
      return { slug: data.user.orgSlug };
    } catch (err) {
      return { error: describeFetchError(err, "Connection error. Please try again.") };
    }
  },

  logout: async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.warn("Logout request failed (session may already be expired):", error);
    }
    set({
      currentTeamAccount: null,
      isAdmin: false,
      userProfile: null,
      teamDataLoaded: false,
      authLoading: false,
    });
  },

  setTeamDataLoaded: (v) => set({ teamDataLoaded: v }),
});
