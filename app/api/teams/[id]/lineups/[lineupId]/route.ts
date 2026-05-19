import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { TeamLineup } from "@/lib/types";

export async function PUT(
  request: Request,
  { params }: { params: { id: string; lineupId: string } }
) {
  const teamId = Number(params.id);
  const lineupId = Number(params.lineupId);

  if (Number.isNaN(teamId) || Number.isNaN(lineupId)) {
    return NextResponse.json({ error: "Invalid team id or lineup id." }, { status: 400 });
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Lineup not found." }, { status: 404 });
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

  return NextResponse.json({ lineup });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; lineupId: string } }
) {
  const teamId = Number(params.id);
  const lineupId = Number(params.lineupId);

  if (Number.isNaN(teamId) || Number.isNaN(lineupId)) {
    return NextResponse.json({ error: "Invalid team id or lineup id." }, { status: 400 });
  }

  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("team_lineups")
    .delete()
    .match({ id: lineupId, team_id: teamId });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
