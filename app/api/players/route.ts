import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .order("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ players: data });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from("players")
      .insert({
        team_id: body.team_id || body.teamId,
        name: body.name,
        position: body.position,
        jersey_number: body.jersey_number ?? body.jerseyNumber,
        is_captain: body.is_captain ?? body.isCaptain ?? false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ player: data });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
