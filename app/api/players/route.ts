import { createClient } from "@/lib/supabase/server";
import {
  asBoolean,
  asInteger,
  asString,
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  ownsTeam,
  parseJsonObject,
  rateLimit,
  rateLimitResponse,
  requireAuth,
  sanitizeText,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;

    const url = new URL(request.url);
    const orgId = url.searchParams.get("org_id") || auth!.orgMembership?.organization_id;

    let query = supabase
      .from("players")
      .select("*, teams(organization_id)")
      .order("id");

    if (orgId) {
      const { data: orgTeams } = await supabase
        .from("teams")
        .select("id")
        .eq("organization_id", orgId);
      const teamIds = (orgTeams || []).map((t) => t.id);
      if (teamIds.length > 0) query = query.in("team_id", teamIds);
      else return json({ players: [] });
    } else if (!auth!.isAdmin && !auth!.orgMembership) {
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
    const ip = getClientIp(request);

    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;

    const limited = rateLimit({ key: `players:create:${ip}:${auth!.userId}`, limit: 30, windowMs: 60 * 60_000 });
    if (limited.limited) {
      logSecurityEvent("player_create_rate_limited", { ip, userId: auth!.userId });
      return rateLimitResponse(limited.resetAt);
    }

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
