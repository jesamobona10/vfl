import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  parseJsonObject,
  rateLimit,
  rateLimitResponse,
  requireOrgAdmin,
  requireOrgMember,
} from "@/lib/security";
import { resolveSeasonOrganization } from "@/lib/season-org";

export const dynamic = "force-dynamic";

async function resolveSeason(sb: any, seasonId: string) {
  const { season, organizationId } = await resolveSeasonOrganization(sb, seasonId);
  return season ? { ...season, competition: { organization_id: organizationId } } : null;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);

    const sb = createServiceRoleClient();
    const season = await resolveSeason(sb, params.id);

    if (!season) return json({ error: "Season not found." }, { status: 404 });

    const memberError = requireOrgMember(auth, (season.competition as any).organization_id);
    if (memberError) return memberError;

    // season teams stored in `season_teams` (season_id, team_id, display_name, logo)
    const { data: seasonTeams, error } = await sb
      .from("season_teams")
      .select("*, team:team_id(id, name, logo_url)")
      .eq("season_id", params.id)
      .order("display_name", { ascending: true });

    if (error) {
      logApiError("season_teams_error", error);
      return json({ error: "Failed to fetch season teams." }, { status: 500 });
    }

    return json({ teams: seasonTeams || [] });
  } catch (error) {
    logApiError("season_teams_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const ip = getClientIp(request);
    const limited = rateLimit({ key: `season_team_register:${ip}`, limit: 30, windowMs: 60_000 });
    if (limited.limited) return rateLimitResponse(limited.resetAt);

    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    if (!auth) return json({ error: "Unauthorized" }, { status: 401 });

    const sb = createServiceRoleClient();
    const season = await resolveSeason(sb, params.id);
    if (!season) return json({ error: "Season not found." }, { status: 404 });

    const adminError = requireOrgAdmin(auth, (season.competition as any).organization_id);
    if (adminError) {
      logSecurityEvent("season_team_register_forbidden", {
        userId: auth.userId,
        seasonId: params.id,
        organizationId: (season.competition as any).organization_id,
      });
      return adminError;
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const teamIdsRaw = parsed.data!.team_ids ?? parsed.data!.teamIds;
    if (!Array.isArray(teamIdsRaw) || teamIdsRaw.length === 0) {
      return json({ error: "team_ids must be a non-empty array." }, { status: 400 });
    }

    const teamIds = teamIdsRaw
      .map((v: unknown) => (typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN))
      .filter((n: number) => Number.isInteger(n) && n > 0);

    if (teamIds.length === 0) {
      return json({ error: "team_ids must be valid team ids." }, { status: 400 });
    }

    // Verify teams belong to the competition's organization
    const { data: orgTeams } = await sb
      .from("teams")
      .select("id, name, logo_url")
      .in("id", teamIds)
      .eq("organization_id", (season.competition as any).organization_id);

    if (!orgTeams || orgTeams.length === 0) {
      return json(
        { error: "None of the specified teams belong to this organization." },
        { status: 400 }
      );
    }

    const existing = await sb
      .from("season_teams")
      .select("team_id")
      .eq("season_id", params.id)
      .in(
        "team_id",
        orgTeams.map((t: any) => t.id)
      );
    const existingIds = new Set((existing.data || []).map((st: any) => st.team_id));

    const rows = orgTeams
      .filter((t: any) => !existingIds.has(t.id))
      .map((t: any) => ({
        season_id: params.id,
        team_id: t.id,
        display_name: t.name,
        logo_url: t.logo_url || null,
        status: "active",
      }));

    if (rows.length > 0) {
      const { error } = await sb.from("season_teams").insert(rows);
      if (error) {
        logApiError("season_team_register_error", error);
        return json({ error: "Failed to register teams." }, { status: 500 });
      }
    }

    logSecurityEvent("season_teams_registered", {
      userId: auth.userId,
      orgId: (season.competition as any).organization_id,
      seasonId: params.id,
      teamCount: rows.length,
    });

    const { data: seasonTeams } = await sb
      .from("season_teams")
      .select("*, team:team_id(id, name, logo_url)")
      .eq("season_id", params.id);

    return json({ teams: seasonTeams || [], registered: rows.length });
  } catch (error) {
    logApiError("season_team_register_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
