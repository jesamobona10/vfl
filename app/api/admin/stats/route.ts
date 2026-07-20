import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAuthContext, json, logApiError, requireAdmin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const sb = createServiceRoleClient();

    const [orgs, teams, players, fixtures, competitions, cupMatches, members, accounts, adminUsers] = await Promise.all([
      sb.from("organizations").select("*", { count: "exact", head: true }),
      sb.from("teams").select("*", { count: "exact", head: true }),
      sb.from("players").select("*", { count: "exact", head: true }),
      sb.from("fixtures").select("*", { count: "exact", head: true }),
      sb.from("competitions").select("*", { count: "exact", head: true }),
      sb.from("cup_matches").select("*", { count: "exact", head: true }),
      sb.from("organization_members").select("*", { count: "exact", head: true }),
      sb.from("team_accounts").select("*", { count: "exact", head: true }),
      sb.from("admin_users").select("*", { count: "exact", head: true }),
    ]);

    return json({
      stats: {
        organizations: orgs.count ?? 0,
        teams: teams.count ?? 0,
        players: players.count ?? 0,
        fixtures: fixtures.count ?? 0,
        competitions: competitions.count ?? 0,
        cupMatches: cupMatches.count ?? 0,
        orgMembers: members.count ?? 0,
        teamAccounts: accounts.count ?? 0,
        adminUsers: adminUsers.count ?? 0,
      },
    });
  } catch (error) {
    logApiError("admin_stats_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
