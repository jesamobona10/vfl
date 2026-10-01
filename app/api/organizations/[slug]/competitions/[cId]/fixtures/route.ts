import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  asInteger,
  asOptionalString,
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  rateLimit,
  rateLimitResponse,
  requireAuth,
  requireOrgAdmin,
  sanitizeText,
} from "@/lib/security";

export const dynamic = "force-dynamic";

/**
 * Create a single manual fixture for a competition season.
 *
 * The id is assigned by the database. FixtureCreator previously derived ids
 * client-side (max(existing) + 1), which collides with fixtures belonging to
 * other competitions in the same organization.
 */
export async function POST(
  request: Request,
  props: { params: Promise<{ slug: string; cId: string }> }
) {
  const { slug, cId } = await props.params;
  try {
    const ip = getClientIp(request);
    const limited = await rateLimit({
      key: `org_fixture_create:${ip}`,
      limit: 30,
      windowMs: 60_000,
    });
    if (limited.limited) return rateLimitResponse(limited.resetAt);

    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;

    const sb = createServiceRoleClient();

    const { data: org } = await sb
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .single();

    if (!org) {
      return json({ error: "Organization not found." }, { status: 404 });
    }

    const orgAdminError = requireOrgAdmin(auth, org.id);
    if (orgAdminError) {
      logSecurityEvent("org_fixture_create_forbidden", {
        userId: auth!.userId,
        slug,
        orgId: org.id,
      });
      return orgAdminError;
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const round = asInteger(body.round, 1, 999);
    const homeTeamId = asInteger(body.home_team_id ?? body.homeId, 1);
    const awayTeamId = asInteger(body.away_team_id ?? body.awayId, 1);
    const seasonId = asOptionalString(body.season_id ?? body.seasonId, 64);
    const date = asOptionalString(body.date, 10);
    const time = asOptionalString(body.time, 8);
    const venue = asOptionalString(body.venue, 120);

    if (!round || !homeTeamId || !awayTeamId) {
      return json(
        { error: "Round, home team, and away team are required." },
        { status: 400 }
      );
    }
    if (homeTeamId === awayTeamId) {
      return json({ error: "Home and away teams must be different." }, { status: 400 });
    }
    if (!seasonId) {
      return json({ error: "A season is required to add a fixture." }, { status: 400 });
    }

    // IDOR guards. The service-role client bypasses RLS, so the competition,
    // season, and both teams must be verified against the caller's org.
    const { data: competition } = await sb
      .from("competitions")
      .select("id")
      .eq("id", cId)
      .eq("organization_id", org.id)
      .maybeSingle();
    if (!competition) {
      return json({ error: "Competition not found for this organization." }, { status: 404 });
    }

    const { data: season } = await sb
      .from("seasons")
      .select("id, competition_id")
      .eq("id", seasonId)
      .eq("competition_id", cId)
      .maybeSingle();
    if (!season) {
      return json({ error: "Season does not belong to this competition." }, { status: 400 });
    }

    const { data: seasonTeams } = await sb
      .from("season_teams")
      .select("team_id")
      .eq("season_id", seasonId);
    const registered = new Set((seasonTeams || []).map((st: any) => st.team_id as number));

    for (const teamId of [homeTeamId, awayTeamId]) {
      if (!registered.has(teamId)) {
        return json(
          { error: "Both teams must be registered for this season." },
          { status: 400 }
        );
      }
    }

    const { data, error } = await sb
      .from("fixtures")
      .insert({
        round,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        season_id: seasonId,
        competition_id: cId,
        status: "scheduled",
        date: date || null,
        time: time || null,
        venue: venue ? sanitizeText(venue) : null,
      })
      .select("id, round, home_team_id, away_team_id, season_id, competition_id")
      .single();

    if (error || !data) {
      logApiError("org_fixture_create_failed", error, { userId: auth!.userId });
      return json({ error: "Unable to create fixture." }, { status: 500 });
    }

    return json({ success: true, fixture: data }, { status: 201 });
  } catch (error) {
    logApiError("org_fixture_create_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}