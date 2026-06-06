import type { StateCreator } from "zustand";
import type { Organization, OrgMember } from "../types";

export interface OrgSlice {
  currentOrg: Organization | null;
  myOrgs: Organization[];
  orgMembers: OrgMember[];
  orgLoading: boolean;

  setCurrentOrg: (org: Organization | null) => void;
  fetchMyOrgs: () => Promise<void>;
  fetchOrgBySlug: (slug: string) => Promise<Organization | null>;
  fetchOrgMembers: (orgId: string) => Promise<void>;
}

export const createOrgSlice: StateCreator<any, [], [], OrgSlice> = (set) => ({
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
    } catch {
      // silently fail
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
    } catch {
      set({ orgLoading: false });
      return null;
    }
  },

  fetchOrgMembers: async (orgId) => {
    try {
      const res = await fetch(`/api/org/${orgId}/members`);
      if (!res.ok) return;
      const data = await res.json();
      set({ orgMembers: data.members || [] });
    } catch {
      // silently fail
    }
  },
});
