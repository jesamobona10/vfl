import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { json } from "@/lib/security";

export type EntitlementStatus = "active" | "trialing" | "past_due" | "expired" | "canceled";

/** Statuses that permit writes. Everything else blocks them. */
const MANAGEABLE_STATUSES = new Set<string>(["active", "trialing"]);

const ENTITLEMENT_ERROR =
  "This season is not active. Renew your plan to make changes.";

interface EntitlementRow {
  org_season_id: string | null;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
}

function isWithinWindow(row: EntitlementRow, now: Date): boolean {
  if (row.starts_at && new Date(row.starts_at) > now) return false;
  if (row.ends_at && new Date(row.ends_at) < now) return false;
  return true;
}

/**
 * Whether writes to a season are permitted.
 *
 * Resolution order: a season-scoped entitlement (`org_season_id` match) wins
 * over an org-wide one (`org_season_id` NULL). When no entitlement covers the
 * season the write is allowed — this is the grandfather rule, so shipping the
 * table changes no behavior until billing starts writing rows.
 *
 * Read access is never gated by this function.
 *
 * @param orgId - Owning organization id.
 * @param orgSeasonId - `organization_seasons.id`, or null/undefined for an
 *   org-wide check.
 */
export async function canManageSeason(
  orgId: string,
  orgSeasonId?: string | null
): Promise<boolean> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("season_entitlements")
    .select("org_season_id, status, starts_at, ends_at")
    .eq("organization_id", orgId);

  // Fail open: if the table is unavailable (e.g. migration not yet applied) we
  // must not block writes that worked before this feature existed.
  if (error) {
    console.error("Entitlement lookup failed", { orgId, reason: error.message });
    return true;
  }
  if (!data || data.length === 0) return true;

  const rows = data as EntitlementRow[];
  const seasonScoped = orgSeasonId ? rows.find((r) => r.org_season_id === orgSeasonId) : undefined;
  const orgWide = rows.find((r) => r.org_season_id === null);
  const row = seasonScoped ?? orgWide;

  // No entitlement covers this season → grandfathered.
  if (!row) return true;
  if (!MANAGEABLE_STATUSES.has(row.status)) return false;
  return isWithinWindow(row, new Date());
}

/**
 * Route guard: rejects writes when the season is not entitled. Returns a
 * Response to send back, or null when the write may proceed.
 */
export async function requireSeasonEntitlement(
  orgId: string,
  orgSeasonId?: string | null
): Promise<Response | null> {
  if (await canManageSeason(orgId, orgSeasonId)) return null;
  return json({ error: ENTITLEMENT_ERROR }, { status: 402 });
}

/**
 * Route guard for writes keyed by a competition season (`seasons.id`).
 * Resolves the owning org-season, then applies the entitlement check.
 */
export async function requireSeasonEntitlementForCompetitionSeason(
  orgId: string,
  competitionSeasonId?: string | null
): Promise<Response | null> {
  let orgSeasonId: string | null = null;

  if (competitionSeasonId) {
    const sb = createServiceRoleClient();
    const { data } = await sb
      .from("seasons")
      .select("organization_season_id")
      .eq("id", competitionSeasonId)
      .maybeSingle();
    orgSeasonId = (data?.organization_season_id as string | null) ?? null;
  }

  return requireSeasonEntitlement(orgId, orgSeasonId);
}
