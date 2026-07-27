import { createPublicClient } from "@/lib/supabase/public";
import { sortMatchesByDateTime } from "@/lib/utils/helpers";
import { json, logApiError } from "@/lib/security";

export const dynamic = "force-dynamic";

/**
 * Public live scores endpoint.
 *
 * Uses the anon (public) Supabase client and queries a restricted
 * database view (public_live) that only exposes minimal fields for
 * live, in-progress, or today's scheduled fixtures. No service-role
 * key involved — if RLS or the view is misconfigured, the leak is
 * limited to what the view intentionally exposes.
 */
export async function GET() {
  try {
    const sb = createPublicClient();

    const { data: rows, error } = await sb
      .from("public_live")
      .select("*")
      .order("round")
      .order("match_id");

    if (error) {
      logApiError("public_live_query_failed", error);
      return json({ error: "Unable to load live data." }, { status: 500 });
    }

    const live: any[] = [];
    const upcoming: any[] = [];

    for (const row of rows || []) {
      const match = {
        id: row.match_id,
        round: row.round,
        homeTeam: { name: row.home_team_name, logo: row.home_team_logo || undefined },
        awayTeam: { name: row.away_team_name, logo: row.away_team_logo || undefined },
        homeScore: row.home_score,
        awayScore: row.away_score,
        status: row.status,
        date: row.date,
        time: row.time,
        venue: row.venue,
      };
      if (row.status === "live" || row.status === "in-progress") {
        live.push(match);
      } else {
        upcoming.push(match);
      }
    }

    return json({
      live: sortMatchesByDateTime(live),
      upcoming: sortMatchesByDateTime(upcoming),
      today: new Date().toISOString().split("T")[0],
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    logApiError("public_live_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
