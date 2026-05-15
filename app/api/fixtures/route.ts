import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("fixtures")
      .select("*")
      .order("round")
      .order("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ fixtures: data });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from("fixtures")
      .insert({
        round: body.round,
        home_team_id: body.home_team_id ?? body.homeTeamId,
        away_team_id: body.away_team_id ?? body.awayTeamId,
        date: body.date || null,
        time: body.time || null,
        venue: body.venue || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ fixture: data });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
