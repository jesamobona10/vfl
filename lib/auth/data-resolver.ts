import { createClient } from "@/lib/supabase/server";
import { resolveSession } from "@/lib/auth/session-resolver";
import { logApiError } from "@/lib/security";
import type { Team, Player, FixtureRow } from "@/lib/types";

/**
 * Server-side data resolution result for org admin / super admin.
 * Mirrors the data that refreshOrgData/refreshAdminData would fetch client-side.
 */
export type DataResult =
  | { ok: true; teams: Team[]; players: Player[]; fixtures: FixtureRow[] }
  | { ok: false };

/**
 * Resolve org/team data during SSR for authenticated org admins and super admins.
 * Runs after session resolution so it can use the same org_id context.
 * Directly queries the database using the same logic as the API routes.
 */
export async function resolveOrgData(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<DataResult> {
  try {
    const sessionResult = await resolveSession(supabase);

    if (!("authenticated" in sessionResult) || !sessionResult.authenticated) {
      return { ok: false };
    }

    const isAdmin = sessionResult.role === "super_admin";
    const orgId = sessionResult.role === "org_admin" ? sessionResult.profile.org?.id : undefined;

    if (!isAdmin && !orgId) {
      return { ok: false };
    }

    // Build org filter - super_admin sees all, org_admin sees only their org
    const teamsQuery = orgId
      ? supabase.from("teams").select("*").eq("organization_id", orgId)
      : supabase.from("teams").select("*");
    const playersQuery = orgId
      ? supabase.from("players").select("*").eq("organization_id", orgId)
      : supabase.from("players").select("*");
    const fixturesQuery = orgId
      ? supabase.from("fixtures").select("*").eq("organization_id", orgId)
      : supabase.from("fixtures").select("*");

    const [teamsRes, playersRes, fixturesRes] = await Promise.all([
      teamsQuery,
      playersQuery,
      fixturesQuery,
    ]);

    if (teamsRes.error) throw teamsRes.error;
    if (playersRes.error) throw playersRes.error;
    if (fixturesRes.error) throw fixturesRes.error;

    return {
      ok: true,
      teams: teamsRes.data || [],
      players: playersRes.data || [],
      fixtures: fixturesRes.data || [],
    };
  } catch (error) {
    logApiError("data_resolver_error", error);
    return { ok: false };
  }
}