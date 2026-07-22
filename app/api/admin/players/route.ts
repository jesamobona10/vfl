import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAuthContext, getClientIp, json, logApiError, logSecurityEvent, parseJsonObject, rateLimit, rateLimitResponse, requireAdmin, sanitizeText } from "@/lib/security";
import type { Player } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const url = new URL(request.url);
    const teamId = url.searchParams.get("team_id");
    const orgId = url.searchParams.get("org_id");

    const sb = createServiceRoleClient();

    let query = sb.from("players").select("*, teams(name, organization_id)").order("id");
    if (teamId) query = query.eq("team_id", teamId);

    const { data: dbPlayers, error } = await query;

    if (error) {
      logApiError("admin_players_list_error", error);
      return json({ error: "Failed to list players." }, { status: 500 });
    }

    let players = (dbPlayers || []).map((p: any) => ({
      id: p.id,
      teamId: p.team_id,
      teamName: p.teams?.name || null,
      organizationId: p.teams?.organization_id || null,
      name: p.name,
      position: p.position,
      number: p.jersey_number || 0,
      goals: p.goals ?? 0,
      assists: p.assists ?? 0,
      yellowCards: p.yellow_cards ?? 0,
      redCards: p.red_cards ?? 0,
      rating: p.rating ?? 6.0,
      photo_url: p.photo_url,
    }));

    if (orgId) players = players.filter((p) => p.organizationId === orgId);

    return json({ players });
  } catch (error) {
    logApiError("admin_players_list_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const ip = getClientIp(request);
    const limited = rateLimit({ key: `admin:players:create:${ip}:${auth!.userId}`, limit: 60, windowMs: 60 * 60_000 });
    if (limited.limited) {
      logSecurityEvent("admin_player_create_rate_limited", { ip, userId: auth!.userId });
      return rateLimitResponse(limited.resetAt);
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const name = sanitizeText(parsed.data!.name as string || "");
    const team_id = Number(parsed.data!.team_id);
    const position = (parsed.data!.position as string) || "MID";
    const jersey_number = parsed.data!.jersey_number ? Number(parsed.data!.jersey_number) : null;

    if (!name || name.length > 100) return json({ error: "Player name is required (max 100 chars)." }, { status: 400 });
    if (!team_id || isNaN(team_id)) return json({ error: "Team ID is required." }, { status: 400 });
    if (!["GK", "DEF", "MID", "ATT"].includes(position)) return json({ error: "Position must be GK, DEF, MID, or ATT." }, { status: 400 });

    const sb = createServiceRoleClient();

    const { data: team } = await sb.from("teams").select("id").eq("id", team_id).single();
    if (!team) return json({ error: "Team not found." }, { status: 404 });

    const { data, error } = await sb.from("players").insert({ name, team_id, position, jersey_number }).select().single();

    if (error) {
      logApiError("admin_player_create_error", error);
      return json({ error: "Failed to create player." }, { status: 500 });
    }

    return json({ player: data });
  } catch (error) {
    logApiError("admin_player_create_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
