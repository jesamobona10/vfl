import { createClient } from "@/lib/supabase/server";
import type { TeamLineup } from "@/lib/types";
import { getAuthContext, json, logApiError, ownsTeam, parseJsonObject, sanitizeText } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: { id: string; lineupId: string } }
) {
  const teamId = Number(params.id);
  const lineupId = Number(params.lineupId);

  if (Number.isNaN(teamId) || Number.isNaN(lineupId)) {
    return json({ error: "Invalid team id or lineup id." }, { status: 400 });
  }

  const parsed = await parseJsonObject(request);
  if (parsed.error) return json({ error: parsed.error }, { status: 400 });
  const body = parsed.data!;
  const name = sanitizeText(String(body.name || "").trim()).slice(0, 80);
  const formation = sanitizeText(String(body.formation || "").trim()).slice(0, 40);
  const slots = Array.isArray(body.slots) ? body.slots : [];
  const isActive = typeof body.is_active === "boolean" ? body.is_active : false;

  if (!name || !formation || slots.length === 0) {
    return json({ error: "Name, formation, and slots are required." }, { status: 400 });
  }

  const supabase = createClient();
  const auth = await getAuthContext(supabase);

  if (!auth) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!ownsTeam(auth, teamId)) {
    return json({ error: "Forbidden" }, { status: 403 });
  }

  if (isActive) {
    await supabase.from("team_lineups").update({ is_active: false }).eq("team_id", teamId);
  }

  const { data, error } = await supabase
    .from("team_lineups")
    .update({
      name,
      formation,
      slots,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .match({ id: lineupId, team_id: teamId })
    .select()
    .single();

  if (error) {
    logApiError("lineup_update_failed", error, { userId: auth.userId, teamId, lineupId });
    return json({ error: "Unable to update lineup." }, { status: 500 });
  }

  if (!data) {
    return json({ error: "Lineup not found." }, { status: 404 });
  }

  const lineup: TeamLineup = {
    id: data.id,
    teamId: data.team_id,
    name: data.name,
    formation: data.formation,
    slots: data.slots,
    isActive: data.is_active ?? false,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };

  return json({ lineup });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; lineupId: string } }
) {
  const teamId = Number(params.id);
  const lineupId = Number(params.lineupId);

  if (Number.isNaN(teamId) || Number.isNaN(lineupId)) {
    return json({ error: "Invalid team id or lineup id." }, { status: 400 });
  }

  const supabase = createClient();
  const auth = await getAuthContext(supabase);

  if (!auth) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!ownsTeam(auth, teamId)) {
    return json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("team_lineups")
    .delete()
    .match({ id: lineupId, team_id: teamId });

  if (error) {
    logApiError("lineup_delete_failed", error, { userId: auth.userId, teamId, lineupId });
    return json({ error: "Unable to delete lineup." }, { status: 500 });
  }

  return json({ success: true });
}
