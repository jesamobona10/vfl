import { useQuery } from "@tanstack/react-query";
import type { Organization, OrgMember } from "@/lib/types";
import { fetchJson } from "@/lib/utils/fetch";

/**
 * Fetch an organization by its URL slug.
 *
 * @param slug - The organization's URL slug.
 * @returns React Query result containing the {@link Organization}.
 */
export function useOrg(slug: string | undefined) {
  return useQuery({
    queryKey: ["org", slug],
    queryFn: () => fetchJson<{ org: Organization }>(`/api/org/${slug}`).then((d) => d.org),
    enabled: !!slug,
  });
}

/**
 * Fetch all organizations the current user belongs to.
 *
 * @returns React Query result containing an array of {@link Organization}.
 */
export function useMyOrgs() {
  return useQuery({
    queryKey: ["my-orgs"],
    queryFn: () => fetchJson<{ orgs: Organization[] }>("/api/org/my-orgs").then((d) => d.orgs),
  });
}

/**
 * Fetch all members of an organization.
 *
 * @param orgId - The organization UUID.
 * @returns React Query result containing an array of {@link OrgMember}.
 */
export function useOrgMembers(orgId: string | undefined) {
  return useQuery({
    queryKey: ["org-members", orgId],
    queryFn: () =>
      fetchJson<{ members: OrgMember[] }>(`/api/org/${orgId}/members`).then((d) => d.members),
    enabled: !!orgId,
  });
}
