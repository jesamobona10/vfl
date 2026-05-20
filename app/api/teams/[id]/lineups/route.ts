import { createClient } from "@/lib/supabase/server";
import type { TeamLineup } from "@/lib/types";
import { getAuthContext, json, logApiError, ownsTeam, parseJsonObject, sanitizeText } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const teamId = Number(params.id);

  if (Number.isNaN(teamId)) {
    return json({ error: "Invalid team id." }, { status: 400 });
  }

  const supabase = createClient();
  const auth = await getAuthContext(supabase);

  if (!auth) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!ownsTeam(auth, teamId)) {
    return json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("team_lineups")
    .select("*")
    .eq("team_id", teamId)
    .order("id", { ascending: true });

  if (error) {
    logApiError("lineups_list_failed", error, { userId: auth.userId, teamId });
    return json({ error: "Unable to load lineups." }, { status: 500 });
  }

  const lineups: TeamLineup[] = (data || []).map((row: any) => ({
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    formation: row.formation,
    slots: row.slots,
    isActive: row.is_active ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return json({ lineups });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const teamId = Number(params.id);

  if (Number.isNaN(teamId)) {
    return json({ error: "Invalid team id." }, { status: 400 });
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
    .insert([
      {
        team_id: teamId,
        name,
        formation,
        slots,
        is_active: isActive,
      },
    ])
    .select()
    .single();

  if (error) {
    logApiError("lineup_create_failed", error, { userId: auth.userId, teamId });
    return json({ error: "Unable to create lineup." }, { status: 500 });
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

  return json({ lineup }, { status: 201 });
}
