import { createClient } from "@/lib/supabase/server";
import {
  asBoolean,
  asInteger,
  asString,
  getAuthContext,
  json,
  logApiError,
  ownsTeam,
  parseJsonObject,
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
      .from("players")
      .select("*")
      .order("id");
    if (!auth!.isAdmin && !auth!.orgMembership) {
      if (!auth!.teamAccount?.team_id) return json({ players: [] });
      query = query.eq("team_id", auth!.teamAccount.team_id);
    }

    const { data, error } = await query;

    if (error) {
      logApiError("players_list_failed", error, { userId: auth!.userId });
      return json({ error: "Unable to load players." }, { status: 500 });
    }
    return json({ players: data });
  } catch (error) {
    logApiError("players_list_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    let teamIdToUse = asInteger(parsed.data!.team_id ?? parsed.data!.teamId, 1);
    if (!auth!.isAdmin) teamIdToUse = auth!.teamAccount?.team_id ?? null;

    if (!teamIdToUse || !ownsTeam(auth!, teamIdToUse)) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    const name = asString(parsed.data!.name, 80);
    const position = asString(parsed.data!.position, 40);
    const jerseyNumber = asInteger(
      parsed.data!.jersey_number ?? parsed.data!.jerseyNumber,
      0,
      999
    );
    const isCaptain = asBoolean(parsed.data!.is_captain ?? parsed.data!.isCaptain) ?? false;

    if (!name || !position) {
      return json({ error: "Name and position are required." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("players")
      .insert({
        team_id: teamIdToUse,
        name: sanitizeText(name),
        position: sanitizeText(position),
        jersey_number: jerseyNumber,
        is_captain: isCaptain,
      })
      .select()
      .single();

    if (error) {
      logApiError("player_create_failed", error, { userId: auth!.userId, teamId: teamIdToUse });
      return json({ error: "Unable to create player." }, { status: 400 });
    }
    return json({ player: data });
  } catch (error) {
    logApiError("player_create_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
