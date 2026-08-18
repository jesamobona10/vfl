import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  getAuthContext,
  actorRole,
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  rateLimit,
  rateLimitResponse,
  requireAuth,
  requireOrgAdmin,
  writeAuditRecord,
} from "@/lib/security";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { generateRoundRobinFixtures } from "@/lib/logic/round-robin";
import type { Team, FixtureRound, Match } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const ip = getClientIp(request);
    const limited = rateLimit({ key: `comp_generate_fixtures:${ip}`, limit: 5, windowMs: 60_000 });
    if (limited.limited) return rateLimitResponse(limited.resetAt);
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;

    const sb = createServiceRoleClient();

    const { data: competition } = await sb
      .from("competitions")
      .select("*")
      .eq("id", params.id)
      .single();

    if (!competition) {
      return json({ error: "Competition not found." }, { status: 404 });
    }

    const adminError = requireOrgAdmin(auth, competition.organization_id);
    if (adminError) {
      logSecurityEvent("fixture_generate_forbidden", {
        userId: auth?.userId,
        competitionId: params.id,
        organizationId: competition.organization_id,
      });
      return adminError;
    }

    if (competition.type !== "league") {
      return json(
        { error: "Fixtures can only be generated for league competitions." },
        { status: 400 }
      );
    }

    let seasonId: string | null = null;
    try {
      const body = await request.json();
      seasonId = body.season_id || null;
    } catch {
      // body is optional, proceed without season_id
    }

    // Resolve season: use explicit season_id, or find/create active season
    if (seasonId) {
      const { data: season } = await sb
        .from("seasons")
        .select("id")
        .eq("id", seasonId)
        .eq("competition_id", params.id)
        .single();
      if (!season) {
        return json(
          { error: "Specified season does not exist for this competition." },
          { status: 400 }
        );
      }
    } else {
      const { data: existingSeason } = await sb
        .from("seasons")
        .select("id")
        .eq("competition_id", params.id)
        .or("is_current.eq.true,status.eq.active")
        .order("is_current", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSeason) {
        seasonId = existingSeason.id;
      } else {
        const year = new Date().getFullYear();
        const { data: newSeason } = await sb
          .from("seasons")
          .insert({
            competition_id: params.id,
            name: `${year}/${year + 1} Season`,
            status: "active",
            is_current: true,
          })
          .select("id")
          .single();

        if (!newSeason) {
          return json({ error: "Failed to create season for this competition." }, { status: 500 });
        }
        seasonId = newSeason.id;
      }
    }

    const { data: seasonTeams } = await sb
      .from("season_teams")
      .select("team:team_id(id, name, rating)")
      .eq("season_id", seasonId)
      .order("team_id");

    if (!seasonTeams || seasonTeams.length < 2) {
      return json(
        { error: "Register at least 2 teams to this season before generating fixtures." },
        { status: 400 }
      );
    }

    const teams: Team[] = seasonTeams.map((st: any) => ({
      id: st.team.id,
      name: st.team.name,
      rating: st.team.rating ?? 6.0,
    }));

    const rounds = generateRoundRobinFixtures(teams, []);

    const fixtureInserts: any[] = [];
    for (const round of rounds) {
      for (const match of round.matches) {
        fixtureInserts.push({
          competition_id: params.id,
          season_id: seasonId,
          round: match.round,
          home_team_id: match.homeId,
          away_team_id: match.awayId,
          status: "scheduled",
          date: match.date || null,
          time: match.time || null,
          venue: match.venue || null,
        });
      }
    }

    if (fixtureInserts.length > 0) {
      const { error: insertError } = await sb.from("fixtures").insert(fixtureInserts);

      if (insertError) {
        logApiError("fixture_generate_insert_error", insertError);
        return json({ error: "Failed to save fixtures." }, { status: 500 });
      }
    }

    await sb.from("competitions").update({ status: "active" }).eq("id", params.id);

    logSecurityEvent("fixtures_generated", {
      userId: auth?.userId,
      orgId: competition.organization_id,
      competitionId: params.id,
      seasonId,
      roundsCount: rounds.length,
      matchesCount: fixtureInserts.length,
    });
    void writeAuditRecord({
      organizationId: competition.organization_id,
      actorId: auth!.userId,
      actorRole: actorRole(auth),
      action: AUDIT_ACTIONS.FIXTURES_GENERATED,
      resourceType: "FIXTURES",
      resourceId: params.id,
      description: `Generated ${fixtureInserts.length} fixtures across ${rounds.length} rounds`,
      after: {
        competitionId: params.id,
        seasonId,
        roundsCount: rounds.length,
        matchesCount: fixtureInserts.length,
      },
      metadata: { competitionId: params.id, seasonId },
      ip,
    }).catch(() => {});

    return json({
      success: true,
      roundsCount: rounds.length,
      matchesCount: fixtureInserts.length,
    });
  } catch (error) {
    logApiError("fixture_generate_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
