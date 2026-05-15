import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateRoundRobinFixtures } from "@/lib/logic/round-robin";

export async function POST() {
  try {
    const supabase = await createClient();

    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("id, name")
      .order("id");

    if (teamsError || !teams?.length) {
      return NextResponse.json(
        { error: "No teams found." },
        { status: 400 }
      );
    }

    const { data: existing } = await supabase
      .from("fixtures")
      .select("id")
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "Fixtures already exist. Delete them first to regenerate." },
        { status: 409 }
      );
    }

    const fixtureRounds = generateRoundRobinFixtures(
      teams.map((t) => ({ id: t.id, name: t.name }))
    );

    const rows: {
      round: number;
      home_team_id: number;
      away_team_id: number;
    }[] = [];

    for (const round of fixtureRounds) {
      for (const match of round.matches) {
        rows.push({
          round: match.round,
          home_team_id: match.homeId,
          away_team_id: match.awayId,
        });
      }
    }

    const { error: insertError } = await supabase
      .from("fixtures")
      .insert(rows);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: rows.length });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
