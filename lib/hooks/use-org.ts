import { useQuery } from "@tanstack/react-query";
import type { Organization, OrgMember } from "@/lib/types";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

export function useOrg(slug: string | undefined) {
  return useQuery({
    queryKey: ["org", slug],
    queryFn: () =>
      fetchJson<{ org: Organization }>(`/api/org/${slug}`).then((d) => d.org),
    enabled: !!slug,
  });
}

export function useMyOrgs() {
  return useQuery({
    queryKey: ["my-orgs"],
    queryFn: () =>
      fetchJson<{ orgs: Organization[] }>("/api/org/my-orgs").then(
        (d) => d.orgs
      ),
  });
}

export function useOrgMembers(orgId: string | undefined) {
  return useQuery({
    queryKey: ["org-members", orgId],
    queryFn: () =>
      fetchJson<{ members: OrgMember[] }>(`/api/org/${orgId}/members`).then(
        (d) => d.members
      ),
    enabled: !!orgId,
  });
}
