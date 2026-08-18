import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  asOptionalString,
  asString,
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  parseJsonObject,
  rateLimit,
  rateLimitResponse,
  requireOrgAdmin,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const ip = getClientIp(request);
    const limited = rateLimit({ key: `season_rollover:${ip}`, limit: 10, windowMs: 60_000 });
    if (limited.limited) return rateLimitResponse(limited.resetAt);

    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    if (!auth) return json({ error: "Unauthorized" }, { status: 401 });

    const sb = createServiceRoleClient();
    const { data: competition } = await sb
      .from("competitions")
      .select("id, organization_id")
      .eq("id", params.id)
      .single();

    if (!competition) return json({ error: "Competition not found." }, { status: 404 });

    const adminError = requireOrgAdmin(auth, competition.organization_id);
    if (adminError) {
      logSecurityEvent("season_rollover_forbidden", {
        userId: auth.userId,
        organizationId: competition.organization_id,
        competitionId: params.id,
      });
      return adminError;
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const fromSeasonId = asString(parsed.data!.from_season_id ?? parsed.data!.fromSeasonId, 64);
    const name = asString(parsed.data!.name, 80);
    const shortName = asString(parsed.data!.short_name ?? parsed.data!.shortName, 40);
    const startDate = asOptionalString(parsed.data!.start_date, 10);
    const endDate = asOptionalString(parsed.data!.end_date, 10);

    // Resolve source season: explicit from_season_id, else the current season
    let sourceSeason: any = null;
    if (fromSeasonId) {
      const { data: s } = await sb
        .from("seasons")
        .select("id, name")
        .eq("id", fromSeasonId)
        .eq("competition_id", params.id)
        .single();
      sourceSeason = s;
      if (!s)
        return json({ error: "Source season not found for this competition." }, { status: 400 });
    } else {
      const { data: s } = await sb
        .from("seasons")
        .select("id, name")
        .eq("competition_id", params.id)
        .or("is_current.eq.true,status.eq.active")
        .order("is_current", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      sourceSeason = s;
    }

    if (!sourceSeason) {
      return json({ error: "No source season to copy teams from." }, { status: 400 });
    }

    const defaultName = `${new Date().getFullYear()} Season`;
    const seasonName = name || defaultName;

    // Link the new season to the org's current org-season (if any) so it
    // appears under the org dashboard's season selector.
    const { data: orgSeason } = await sb
      .from("organization_seasons")
      .select("id")
      .eq("organization_id", competition.organization_id)
      .eq("is_current", true)
      .maybeSingle();

    const newSeason = await sb
      .from("seasons")
      .insert({
        competition_id: params.id,
        name: seasonName,
        short_name: shortName || seasonName,
        start_date: startDate || null,
        end_date: endDate || null,
        status: "draft",
        is_current: false,
        organization_season_id: orgSeason?.id || null,
      })
      .select("id, name, short_name, status, is_current")
      .single();

    if (newSeason.error) {
      logApiError("season_rollover_create_error", newSeason.error);
      return json({ error: "Failed to create the new season." }, { status: 500 });
    }

    // Copy registered teams (guide §25) — fixtures/results/stats are NOT copied
    const { data: sourceTeams } = await sb
      .from("season_teams")
      .select("team_id, display_name, logo_url")
      .eq("season_id", sourceSeason.id)
      .eq("status", "active");

    let copiedTeams = 0;
    if (sourceTeams && sourceTeams.length > 0) {
      const rows = sourceTeams.map((st: any) => ({
        season_id: newSeason.data.id,
        team_id: st.team_id,
        display_name: st.display_name,
        logo_url: st.logo_url || null,
        status: "active",
      }));
      const { error, count } = await sb.from("season_teams").insert(rows, { count: "exact" });
      if (error) {
        logApiError("season_rollover_copy_teams_error", error);
      } else {
        copiedTeams = count || 0;
      }
    }

    logSecurityEvent("season_rollover_created", {
      userId: auth.userId,
      orgId: competition.organization_id,
      competitionId: params.id,
      sourceSeasonId: sourceSeason.id,
      newSeasonId: newSeason.data.id,
      copiedTeams,
    });

    return json({ season: newSeason.data, copiedTeams });
  } catch (error) {
    logApiError("season_rollover_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
