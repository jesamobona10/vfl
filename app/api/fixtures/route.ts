import { createClient } from "@/lib/supabase/server";
import {
  asInteger,
  asOptionalString,
  getAuthContext,
  json,
  logApiError,
  parseJsonObject,
  requireAdmin,
  requireAuth,
  sanitizeText,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;

    let query = supabase
      .from("fixtures")
      .select("*")
      .order("round")
      .order("id");
    if (!auth!.isAdmin) {
      const teamId = auth!.teamAccount?.team_id;
      if (!teamId) return json({ fixtures: [] });
      query = query.or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);
    }
    const { data, error } = await query;

    if (error) {
      logApiError("fixtures_list_failed", error, { userId: auth!.userId });
      return json({ error: "Unable to load fixtures." }, { status: 500 });
    }
    return json({ fixtures: data });
  } catch (error) {
    logApiError("fixtures_list_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const round = asInteger(parsed.data!.round, 1, 999);
    const homeTeamId = asInteger(parsed.data!.home_team_id ?? parsed.data!.homeTeamId, 1);
    const awayTeamId = asInteger(parsed.data!.away_team_id ?? parsed.data!.awayTeamId, 1);
    const date = asOptionalString(parsed.data!.date, 10);
    const time = asOptionalString(parsed.data!.time, 8);
    const venue = asOptionalString(parsed.data!.venue, 120);

    if (!round || !homeTeamId || !awayTeamId || homeTeamId === awayTeamId) {
      return json({ error: "Valid round, home team, and away team are required." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("fixtures")
      .insert({
        round,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        date,
        time,
        venue: venue ? sanitizeText(venue) : null,
      })
      .select()
      .single();

    if (error) {
      logApiError("fixture_create_failed", error, { userId: auth!.userId });
      return json({ error: "Unable to create fixture." }, { status: 400 });
    }
    return json({ fixture: data });
  } catch (error) {
    logApiError("fixture_create_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
