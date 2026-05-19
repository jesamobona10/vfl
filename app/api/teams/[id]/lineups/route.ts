import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { TeamLineup } from "@/lib/types";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const teamId = Number(params.id);

  if (Number.isNaN(teamId)) {
    return NextResponse.json({ error: "Invalid team id." }, { status: 400 });
  }

  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("team_lineups")
    .select("*")
    .eq("team_id", teamId)
    .order("id", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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

  return NextResponse.json({ lineups });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const teamId = Number(params.id);

  if (Number.isNaN(teamId)) {
    return NextResponse.json({ error: "Invalid team id." }, { status: 400 });
  }

  const body = await request.json();
  const name = String(body.name || "").trim();
  const formation = String(body.formation || "").trim();
  const slots = Array.isArray(body.slots) ? body.slots : [];
  const isActive = typeof body.is_active === "boolean" ? body.is_active : false;

  if (!name || !formation || slots.length === 0) {
    return NextResponse.json({ error: "Name, formation, and slots are required." }, { status: 400 });
  }

  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json({ error: error.message }, { status: 500 });
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

  return NextResponse.json({ lineup }, { status: 201 });
}
