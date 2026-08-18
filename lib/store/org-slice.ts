import type { StateCreator } from "zustand";
import type { Organization, OrgMember } from "../types";
import type { AppStore } from "./index";

/** Organization state slice managing multi-tenant org data. */
export interface OrgSlice {
  /** The currently active organization (null if none selected). */
  currentOrg: Organization | null;
  /** All organizations the current user belongs to. */
  myOrgs: Organization[];
  /** Members of the currently viewed organization. */
  orgMembers: OrgMember[];
  /** Whether org data is currently being fetched. */
  orgLoading: boolean;

  /** Set the current active organization. */
  setCurrentOrg: (org: Organization | null) => void;
  /** Fetch all organizations the current user belongs to. */
  fetchMyOrgs: () => Promise<void>;
  /** Fetch an organization by its URL slug. */
  fetchOrgBySlug: (slug: string) => Promise<Organization | null>;
  /** Fetch all members of an organization. */
  fetchOrgMembers: (orgId: string) => Promise<void>;
}

export const createOrgSlice: StateCreator<AppStore, [], [], OrgSlice> = (set) => ({
  currentOrg: null,
  myOrgs: [],
  orgMembers: [],
  orgLoading: false,

  setCurrentOrg: (org) => set({ currentOrg: org }),

  fetchMyOrgs: async () => {
    try {
      const res = await fetch("/api/org/my-orgs");
      if (!res.ok) return;
      const data = await res.json();
      set({ myOrgs: data.orgs || [] });
    } catch (error) {
      console.error("fetchMyOrgs failed:", error);
    }
  },

  fetchOrgBySlug: async (slug) => {
    set({ orgLoading: true });
    try {
      const res = await fetch(`/api/org/${slug}`);
      if (!res.ok) {
        set({ orgLoading: false });
        return null;
      }
      const data = await res.json();
      const org: Organization = data.org;
      set({ currentOrg: org, orgLoading: false });
      return org;
    } catch (error) {
      console.error("fetchOrgBySlug failed:", error);
      set({ orgLoading: false });
      return null;
    }
  },

  fetchOrgMembers: async (orgId) => {
    try {
      const res = await fetch(`/api/org/members?org_id=${orgId}`);
      if (!res.ok) return;
      const data = await res.json();
      set({ orgMembers: data.members || [] });
    } catch (error) {
      console.error("fetchOrgMembers failed:", error);
    }
  },
});
