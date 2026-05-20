import { createClient } from "@/lib/supabase/server";
import {
  asInteger,
  asOptionalString,
  asString,
  getAuthContext,
  json,
  logApiError,
  parseJsonObject,
  requireAdmin,
  sanitizeText,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const fixtureId = asInteger(params.id, 1);
    if (!fixtureId) return json({ error: "Invalid fixture id." }, { status: 400 });

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const update: Record<string, unknown> = {};
    const round = asInteger(parsed.data!.round, 1, 999);
    const homeTeamId = asInteger(parsed.data!.home_team_id ?? parsed.data!.homeTeamId, 1);
    const awayTeamId = asInteger(parsed.data!.away_team_id ?? parsed.data!.awayTeamId, 1);
    const homeScore = asInteger(parsed.data!.home_score ?? parsed.data!.homeScore, 0, 99);
    const awayScore = asInteger(parsed.data!.away_score ?? parsed.data!.awayScore, 0, 99);
    const status = asString(parsed.data!.status, 30);
    const date = asOptionalString(parsed.data!.date, 10);
    const time = asOptionalString(parsed.data!.time, 8);
    const venue = asOptionalString(parsed.data!.venue, 120);
    if (round !== null) update.round = round;
    if (homeTeamId !== null) update.home_team_id = homeTeamId;
    if (awayTeamId !== null) update.away_team_id = awayTeamId;
    if (homeScore !== null) update.home_score = homeScore;
    if (awayScore !== null) update.away_score = awayScore;
    if (status && ["scheduled", "live", "in-progress", "completed", "postponed"].includes(status)) {
      update.status = status;
    }
    if (date !== null) update.date = date;
    if (time !== null) update.time = time;
    if (venue !== null) update.venue = venue ? sanitizeText(venue) : null;
    if (update.home_team_id && update.away_team_id && update.home_team_id === update.away_team_id) {
      return json({ error: "Home and away teams must be different." }, { status: 400 });
    }
    if (Object.keys(update).length === 0) {
      return json({ error: "No valid fields to update." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("fixtures")
      .update(update)
      .eq("id", fixtureId)
      .select()
      .single();

    if (error) {
      logApiError("fixture_update_failed", error, { userId: auth!.userId, fixtureId });
      return json({ error: "Unable to update fixture." }, { status: 400 });
    }
    return json({ fixture: data });
  } catch (error) {
    logApiError("fixture_update_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const fixtureId = asInteger(params.id, 1);
    if (!fixtureId) return json({ error: "Invalid fixture id." }, { status: 400 });

    const { error } = await supabase
      .from("fixtures")
      .delete()
      .eq("id", fixtureId);

    if (error) {
      logApiError("fixture_delete_failed", error, { userId: auth!.userId, fixtureId });
      return json({ error: "Unable to delete fixture." }, { status: 400 });
    }
    return json({ success: true });
  } catch (error) {
    logApiError("fixture_delete_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
