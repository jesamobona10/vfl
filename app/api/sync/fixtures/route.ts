import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fixtures } = body;

    if (!fixtures || !Array.isArray(fixtures)) {
      return NextResponse.json(
        { error: "Fixtures array is required." },
        { status: 400 }
      );
    }

    const sb = createServiceRoleClient();

    const allMatches: any[] = [];
    for (const round of fixtures) {
      for (const match of round.matches ?? []) {
        allMatches.push({
          id: Math.trunc(Number(match.id)),
          round: match.round ?? round.round,
          home_team_id: match.homeId ?? match.home_team_id,
          away_team_id: match.awayId ?? match.away_team_id,
          home_score: match.homeScore ?? match.home_score,
          away_score: match.awayScore ?? match.away_score,
          status: match.status ?? "scheduled",
          date: match.date || null,
          time: match.time || null,
          venue: match.venue || null,
        });
      }
    }

    if (allMatches.length === 0) {
      return NextResponse.json(
        { error: "No matches found in fixtures data." },
        { status: 400 }
      );
    }

    const { error: insertError } = await sb.from("fixtures").upsert(allMatches, {
      onConflict: "id",
      ignoreDuplicates: false,
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const { data: synced } = await sb
      .from("fixtures")
      .select("*")
      .order("round")
      .order("id");

    return NextResponse.json({ success: true, fixtures: synced });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
