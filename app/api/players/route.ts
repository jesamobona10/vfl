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
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("id")
      .eq("id", session.user.id)
      .single();

    const { data: teamAccount } = await supabase
      .from("team_accounts")
      .select("id, team_id")
      .eq("id", session.user.id)
      .single();

    if (!adminUser && !teamAccount) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // If user is a team account, force creation under their managed team
    let teamIdToUse = body.team_id || body.teamId;
    if (teamAccount && !adminUser) {
      teamIdToUse = teamAccount.team_id;
    }

    if (!teamIdToUse) {
      return NextResponse.json({ error: "Team is required." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("players")
      .insert({
        team_id: teamIdToUse,
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
