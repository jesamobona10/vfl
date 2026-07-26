import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { generateRoundRobinFixtures } from "@/lib/logic/round-robin";
import type { Team } from "@/lib/types";
import { getAuthContext, json, logApiError, logSecurityEvent, requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;

    const sb = createServiceRoleClient();

    const { data: org } = await sb
      .from("organizations")
      .select("id")
      .eq("slug", params.slug)
      .single();

    if (!org) {
      return json({ error: "Organization not found." }, { status: 404 });
    }

    if (!auth!.isAdmin && (!auth!.orgMembership || auth!.orgMembership.organization_id !== org.id || !["owner", "admin"].includes(auth!.orgMembership.role))) {
      logSecurityEvent("org_generate_fixtures_forbidden", {
        userId: auth!.userId, slug: params.slug, orgId: org.id,
      });
      return json({ error: "Forbidden" }, { status: 403 });
    }

    let competitionId: string | null = null;
    let seasonId: string | null = null;
    try {
      const body = await request.json();
      competitionId = body.competition_id || null;
      // Allow explicit season_id from client
      seasonId = body.season_id || null;
    } catch {
      // body is optional
    }

    if (!competitionId) {
      return json({ error: "competition_id is required." }, { status: 400 });
    }

    // Resolve season: use explicit season_id, or find/create active season for this competition
    if (seasonId) {
      const { data: season } = await sb
        .from("seasons")
        .select("id")
        .eq("id", seasonId)
        .eq("competition_id", competitionId)
        .single();
      if (!season) {
        return json({ error: "Specified season does not exist for this competition." }, { status: 400 });
      }
    } else {
      // Find active season for this competition
      const { data: existingSeason } = await sb
        .from("seasons")
        .select("id")
        .eq("competition_id", competitionId)
        .or("is_current.eq.true,status.eq.active")
        .order("is_current", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (existingSeason) {
        seasonId = existingSeason.id;
      } else {
        // Auto-create a season
        const year = new Date().getFullYear();
        const { data: newSeason } = await sb
          .from("seasons")
          .insert({
            competition_id: competitionId,
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

    const { data: dbTeams } = await sb
      .from("teams")
      .select("*")
      .eq("organization_id", org.id)
      .order("id");

    if (!dbTeams || dbTeams.length < 2) {
      return json({ error: "Need at least 2 teams in the organization." }, { status: 400 });
    }

    const teams: Team[] = dbTeams.map((t: any) => ({
      id: t.id, name: t.name, rating: t.rating ?? 6.0,
    }));

    const rounds = generateRoundRobinFixtures(teams, []);

    const fixtureInserts: any[] = [];
    for (const round of rounds) {
      for (const match of round.matches) {
        fixtureInserts.push({
          competition_id: competitionId,
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
      const { error: insertError } = await sb
        .from("fixtures")
        .insert(fixtureInserts);

      if (insertError) {
        logApiError("org_generate_fixtures_insert_error", insertError);
        return json({ error: "Failed to save fixtures." }, { status: 500 });
      }
    }

    if (competitionId) {
      await sb.from("competitions").update({ status: "active" }).eq("id", competitionId);
    }

    return json({
      success: true,
      roundsCount: rounds.length,
      matchesCount: fixtureInserts.length,
      season_id: seasonId,
    });
  } catch (error) {
    logApiError("org_generate_fixtures_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
