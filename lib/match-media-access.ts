import type { AuthContext } from "@/lib/security";
import { json, requireOrgAdmin } from "@/lib/security";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function getManageableFixtureMediaContext(fixtureId: number, auth: AuthContext) {
  const supabase = createServiceRoleClient();
  const { data: fixture, error: fixtureError } = await supabase
    .from("fixtures")
    .select("id, home_team_id, away_team_id")
    .eq("id", fixtureId)
    .maybeSingle();

  if (fixtureError) return { response: json({ error: "Unable to load fixture." }, { status: 500 }) };
  if (!fixture) return { response: json({ error: "Fixture not found." }, { status: 404 }) };

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, organization_id")
    .in("id", [fixture.home_team_id, fixture.away_team_id]);
  if (teamsError) return { response: json({ error: "Unable to load fixture teams." }, { status: 500 }) };

  const homeTeam = teams?.find((team) => team.id === fixture.home_team_id);
  const awayTeam = teams?.find((team) => team.id === fixture.away_team_id);
  const organizationId = homeTeam?.organization_id;
  if (!organizationId || awayTeam?.organization_id !== organizationId) {
    return { response: json({ error: "Fixture organization could not be resolved." }, { status: 404 }) };
  }

  const isOrgAdmin = requireOrgAdmin(auth, organizationId) === null;
  const managesFixtureTeam = auth.teamAccount?.team_id === fixture.home_team_id ||
    auth.teamAccount?.team_id === fixture.away_team_id;
  if (!auth.isAdmin && !isOrgAdmin && !managesFixtureTeam) {
    return { response: json({ error: "Forbidden." }, { status: 403 }) };
  }

  return { supabase, fixture, organizationId };
}
