import { createPublicClient } from "@/lib/supabase/public";
import { sortMatchesByDateTime } from "@/lib/utils/helpers";
import { json, logApiError } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = createPublicClient();

    const { data: teams, error: teamsError } = await sb
      .from("teams")
      .select("id, name, logo_url")
      .order("id");

    if (teamsError) {
      logApiError("public_live_teams_failed", teamsError);
      return json({ error: "Unable to load live data." }, { status: 500 });
    }

    const teamMap = new Map((teams || []).map((t: any) => [t.id, { name: t.name, logo: t.logo_url || undefined }]));

    const today = new Date().toISOString().split("T")[0];

    const { data: fixtures, error: fixturesError } = await sb
      .from("fixtures")
      .select("*")
      .or(`status.in.(live,in-progress),and(status.eq.scheduled,date.eq.${today})`)
      .order("round")
      .order("id");

    if (fixturesError) {
      logApiError("public_live_fixtures_failed", fixturesError);
      return json({ error: "Unable to load live data." }, { status: 500 });
    }

    const live: any[] = [];
    const upcoming: any[] = [];

    for (const m of fixtures || []) {
      const home = teamMap.get(m.home_team_id) || { name: "Unknown", logo: undefined };
      const away = teamMap.get(m.away_team_id) || { name: "Unknown", logo: undefined };
      const match = {
        id: m.id,
        round: m.round,
        homeTeam: home,
        awayTeam: away,
        homeScore: m.home_score,
        awayScore: m.away_score,
        status: m.status,
        date: m.date,
        time: m.time,
        venue: m.venue,
      };
      if (m.status === "live" || m.status === "in-progress") {
        live.push(match);
      } else {
        upcoming.push(match);
      }
    }

    return json({
      live: sortMatchesByDateTime(live),
      upcoming: sortMatchesByDateTime(upcoming),
      today,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    logApiError("public_live_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
