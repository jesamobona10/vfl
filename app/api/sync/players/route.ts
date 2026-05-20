import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { asInteger, asString, getAuthContext, json, logApiError, parseJsonObject, requireAdmin, sanitizeText } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });
    const players = parsed.data!.players;
    const teamIdMap =
      parsed.data!.teamIdMap && typeof parsed.data!.teamIdMap === "object"
        ? (parsed.data!.teamIdMap as Record<string, unknown>)
        : {};

    if (!players || !Array.isArray(players)) {
      return json(
        { error: "Players array is required." },
        { status: 400 }
      );
    }

    const sb = createServiceRoleClient();

    const rows: any[] = [];
    for (const p of players) {
      const localTeamId = p.teamId ?? p.team_id;
      const dbTeamId = teamIdMap?.[localTeamId] ?? localTeamId;
      const id = p.id != null ? Math.trunc(Number(p.id)) : undefined;
      const name = asString(p.name, 80);
      const position = asString(p.position, 40);
      const teamId = asInteger(dbTeamId, 1);
      if (id == null || isNaN(id) || !name || !position || !teamId) continue;
      rows.push({
        id,
        team_id: teamId,
        name: sanitizeText(name),
        position: sanitizeText(position),
        jersey_number: p.jerseyNumber ?? p.jersey_number,
        is_captain: p.isCaptain ?? p.is_captain ?? false,
        goals: p.goals ?? 0,
        assists: p.assists ?? 0,
        yellow_cards: p.yellowCards ?? p.yellow_cards ?? 0,
        red_cards: p.redCards ?? p.red_cards ?? 0,
        saves: p.saves ?? 0,
        tackles: p.tackles ?? 0,
        clean_sheets: p.cleanSheets ?? p.clean_sheets ?? 0,
        rating: p.rating ?? 0,
      });
    }

    const { error: insertError } = await sb.from("players").upsert(rows, {
      onConflict: "id",
      ignoreDuplicates: false,
    });

    if (insertError) {
      logApiError("sync_players_upsert_failed", insertError, { userId: auth!.userId });
      return json({ error: "Unable to sync players." }, { status: 500 });
    }

    const { data: synced } = await sb
      .from("players")
      .select("*")
      .order("id");

    return json({ success: true, players: synced });
  } catch (error) {
    logApiError("sync_players_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
