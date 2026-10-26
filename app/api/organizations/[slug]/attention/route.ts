import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAuthContext, json, logApiError, requireAuth, requireOrgAdmin } from "@/lib/security";
import { fixtureKickoffUtc } from "@/lib/public-reminders";

export const dynamic = "force-dynamic";

type AttentionTask = {
  id: string;
  type: "fixture_details" | "lineup_review" | "media_review";
  severity: "warning" | "info";
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  fixtureId: number;
  dueAt?: string;
};

const missingOptionalTable = (error: { code?: string } | null) =>
  Boolean(error && ["42P01", "42703", "PGRST204"].includes(error.code || ""));

export async function GET(request: Request, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  try {
    const session = await createClient();
    const auth = await getAuthContext(session);
    const authError = requireAuth(auth);
    if (authError) return authError;

    const service = createServiceRoleClient();
    const { data: organization, error: organizationError } = await service
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (organizationError) throw organizationError;
    if (!organization) return json({ error: "Organization not found." }, { status: 404 });

    const adminError = requireOrgAdmin(auth, organization.id);
    if (adminError) return adminError;

    const url = new URL(request.url);
    const requestedSeasonId = url.searchParams.get("org_season_id");
    let orgSeasonQuery = service.from("organization_seasons").select("id").eq("organization_id", organization.id);
    orgSeasonQuery = requestedSeasonId
      ? orgSeasonQuery.eq("id", requestedSeasonId)
      : orgSeasonQuery.eq("is_current", true);
    const { data: orgSeason, error: orgSeasonError } = await orgSeasonQuery.maybeSingle();
    if (orgSeasonError) throw orgSeasonError;
    if (!orgSeason) return json({ tasks: [] });
    const timezone = process.env.PUBLIC_MATCH_TIMEZONE || "Africa/Lagos";

    const { data: competitions, error: competitionsError } = await service
      .from("competitions")
      .select("id")
      .eq("organization_id", organization.id);
    if (competitionsError) throw competitionsError;
    const competitionIds = (competitions || []).map((row) => row.id as string);
    if (!competitionIds.length) return json({ tasks: [] });

    const { data: seasons, error: seasonsError } = await service
      .from("seasons")
      .select("id, competition_id")
      .eq("organization_season_id", orgSeason.id)
      .in("competition_id", competitionIds);
    if (seasonsError) throw seasonsError;
    const seasonIds = (seasons || []).map((row) => row.id as string);
    if (!seasonIds.length) return json({ tasks: [] });

    const { data: fixtures, error: fixturesError } = await service
      .from("fixtures")
      .select("id, round, home_team_id, away_team_id, competition_id, season_id, status, date, time, venue")
      .in("competition_id", competitionIds)
      .in("season_id", seasonIds)
      .order("date", { ascending: true, nullsFirst: true })
      .limit(1000);
    if (fixturesError) throw fixturesError;

    const fixtureRows = fixtures || [];
    if (!fixtureRows.length) return json({ tasks: [] });
    const fixtureIds = fixtureRows.map((fixture) => fixture.id as number);
    const teamIds = [...new Set(fixtureRows.flatMap((fixture) => [fixture.home_team_id, fixture.away_team_id]))];
    const [{ data: teams, error: teamsError }, { data: lineups, error: lineupsError }, { data: media, error: mediaError }] = await Promise.all([
      service.from("teams").select("id, name").in("id", teamIds),
      service.from("fixture_lineups").select("fixture_id, team_id, submitted_at").eq("organization_id", organization.id).eq("status", "pending").in("fixture_id", fixtureIds),
      service.from("match_media").select("match_id, created_at").eq("organization_id", organization.id).eq("status", "pending").in("match_id", fixtureIds),
    ]);
    if (teamsError) throw teamsError;
    if (lineupsError && !missingOptionalTable(lineupsError)) throw lineupsError;
    if (mediaError && !missingOptionalTable(mediaError)) throw mediaError;

    const teamNames = new Map((teams || []).map((team) => [team.id as number, team.name as string]));
    const fixtureById = new Map(fixtureRows.map((fixture) => [fixture.id as number, fixture]));
    const taskHref = (fixtureId: number) => {
      const fixture = fixtureById.get(fixtureId);
      const competitionId = fixture?.competition_id;
      const seasonId = fixture?.season_id;
      return competitionId
        ? `/org/${slug}/competitions/${competitionId}/fixtures${seasonId ? `?seasonId=${seasonId}` : ""}`
        : `/org/${slug}/competitions`;
    };
    const kickoffIso = (date: string | null, time: string | null) =>
      date && time ? fixtureKickoffUtc(date, time, timezone)?.toISOString() : undefined;
    const tasks: AttentionTask[] = [];

    for (const fixture of fixtureRows) {
      if (fixture.status !== "scheduled") continue;
      const missing = [
        !fixture.date && "date",
        !fixture.time && "kickoff time",
        !fixture.venue && "venue",
      ].filter(Boolean) as string[];
      if (!missing.length) continue;
      const home = teamNames.get(fixture.home_team_id) || "Home team";
      const away = teamNames.get(fixture.away_team_id) || "Away team";
      tasks.push({
        id: `fixture:${fixture.id}:details`,
        type: "fixture_details",
        severity: "warning",
        title: `${home} vs ${away} needs match details`,
        description: `Add ${missing.join(", ")}.`,
        href: taskHref(fixture.id),
        actionLabel: "Open fixture",
        fixtureId: fixture.id,
      });
    }

    const lineupsByFixture = new Map<number, number[]>();
    for (const lineup of lineups || []) {
      const ids = lineupsByFixture.get(lineup.fixture_id) || [];
      ids.push(lineup.team_id);
      lineupsByFixture.set(lineup.fixture_id, ids);
    }
    for (const [fixtureId, pendingTeamIds] of lineupsByFixture) {
      const fixture = fixtureById.get(fixtureId);
      if (!fixture) continue;
      const teamsPending = [...new Set(pendingTeamIds)].map((id) => teamNames.get(id) || "A team");
      tasks.push({
        id: `fixture:${fixtureId}:lineup-review`,
        type: "lineup_review",
        severity: "warning",
        title: `${teamsPending.join(" and ")} lineup${teamsPending.length > 1 ? "s" : ""} awaiting review`,
        description: `Round ${fixture.round}: ${teamNames.get(fixture.home_team_id) || "Home team"} vs ${teamNames.get(fixture.away_team_id) || "Away team"}.`,
        href: taskHref(fixtureId),
        actionLabel: "Review lineup",
        fixtureId,
        dueAt: kickoffIso(fixture.date, fixture.time),
      });
    }

    const mediaByFixture = new Map<number, number>();
    for (const item of media || []) mediaByFixture.set(item.match_id, (mediaByFixture.get(item.match_id) || 0) + 1);
    for (const [fixtureId, count] of mediaByFixture) {
      const fixture = fixtureById.get(fixtureId);
      if (!fixture) continue;
      tasks.push({
        id: `fixture:${fixtureId}:media-review`,
        type: "media_review",
        severity: "info",
        title: `${count} match media item${count === 1 ? "" : "s"} awaiting approval`,
        description: `${teamNames.get(fixture.home_team_id) || "Home team"} vs ${teamNames.get(fixture.away_team_id) || "Away team"}.`,
        href: taskHref(fixtureId),
        actionLabel: "Review media",
        fixtureId,
        dueAt: kickoffIso(fixture.date, fixture.time),
      });
    }

    tasks.sort((a, b) => (a.severity === b.severity ? (a.dueAt || "").localeCompare(b.dueAt || "") : a.severity === "warning" ? -1 : 1));
    return json({ tasks: tasks.slice(0, 30), total: tasks.length, timezone });
  } catch (error) {
    logApiError("organization_attention_tasks_failed", error, { slug });
    return json({ error: "Unable to load organization tasks." }, { status: 500 });
  }
}
