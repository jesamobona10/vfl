import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { players, teamIdMap } = body;

    if (!players || !Array.isArray(players)) {
      return NextResponse.json(
        { error: "Players array is required." },
        { status: 400 }
      );
    }

    const sb = createServiceRoleClient();

    const rows = players.map((p: any) => {
      const localTeamId = p.teamId ?? p.team_id;
      const dbTeamId = teamIdMap?.[localTeamId] ?? localTeamId;
      return {
        id: Math.trunc(Number(p.id)),
        team_id: dbTeamId,
        name: p.name,
        position: p.position,
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
      };
    });

    const { error: insertError } = await sb.from("players").upsert(rows, {
      onConflict: "id",
      ignoreDuplicates: false,
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const { data: synced } = await sb
      .from("players")
      .select("*")
      .order("id");

    return NextResponse.json({ success: true, players: synced });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
