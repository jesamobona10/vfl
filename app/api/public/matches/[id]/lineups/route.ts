import { asInteger, json, logApiError } from "@/lib/security";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const fixtureId = asInteger((await props.params).id, 1);
  if (!fixtureId) return json({ error: "Invalid match id." }, { status: 400 });
  const service = createServiceRoleClient();
  const { data: match, error: matchError } = await service.from("public_matches")
    .select("match_id, organization_id, home_team_id, away_team_id")
    .eq("match_id", fixtureId).maybeSingle();
  if (matchError) {
    logApiError("public_match_lineups_match_query_failed", matchError, { fixtureId });
    return json({ error: "Unable to load match lineups." }, { status: 500 });
  }
  if (!match) return json({ error: "Match not found." }, { status: 404 });
  const { data: organization } = await service.from("organizations")
    .select("public_player_names_enabled")
    .eq("id", match.organization_id).maybeSingle();
  const revealPlayers = Boolean(organization?.public_player_names_enabled);
  const { data: rows, error } = await service.from("fixture_lineups")
    .select("id, team_id, formation, starting_xi, substitutes, status, submitted_at, reviewed_at")
    .eq("fixture_id", fixtureId)
    .eq("status", "approved")
    .in("team_id", [match.home_team_id, match.away_team_id]);
  if (error) {
    // The match centre still works before the lineup migration has been applied.
    if (["42P01", "42703", "PGRST204"].includes((error as any)?.code)) return json({ lineups: [] });
    logApiError("public_match_lineups_query_failed", error, { fixtureId });
    return json({ error: "Unable to load match lineups." }, { status: 500 });
  }
  const playerIds = [...new Set((rows || []).flatMap((row) => [
    ...(Array.isArray(row.starting_xi) ? row.starting_xi : []).map((slot: any) => slot.playerId),
    ...(Array.isArray(row.substitutes) ? row.substitutes : []),
  ]).filter((id): id is number => Number.isInteger(id)))];
  const { data: players } = playerIds.length
    ? await service.from("players").select("id, name, jersey_number, photo_url").in("id", playerIds)
    : { data: [] };
  const byId = new Map((players || []).map((player) => [player.id, player]));
  const lineups = (rows || []).map((row) => ({
    id: row.id,
    team_id: row.team_id,
    formation: row.formation,
    status: row.status,
    starting_xi: (Array.isArray(row.starting_xi) ? row.starting_xi : []).map((slot: any) => {
      const player = byId.get(slot.playerId);
      return {
        slotId: slot.slotId,
        label: slot.label,
        position: slot.position,
        player: player ? {
          id: player.id,
          name: revealPlayers ? player.name : null,
          jersey_number: player.jersey_number,
          photo_url: revealPlayers ? player.photo_url : null,
        } : null,
      };
    }),
    substitutes: (Array.isArray(row.substitutes) ? row.substitutes : []).map((id: number) => {
      const player = byId.get(id);
      return player ? {
        id: player.id,
        name: revealPlayers ? player.name : null,
        jersey_number: player.jersey_number,
        photo_url: revealPlayers ? player.photo_url : null,
      } : null;
    }).filter(Boolean),
  }));
  return json({ lineups, publicPlayerNamesEnabled: revealPlayers });
}
