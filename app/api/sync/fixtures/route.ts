import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("id")
      .eq("id", session.user.id)
      .single();
    if (!adminUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { fixtures, teamIdMap } = body;

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
        const localHomeId = match.homeId ?? match.home_team_id;
        const localAwayId = match.awayId ?? match.away_team_id;
        const id = match.id != null ? Math.trunc(Number(match.id)) : undefined;
        if (id == null || Number.isNaN(id)) continue;
        allMatches.push({
          id,
          round: match.round ?? round.round,
          home_team_id: teamIdMap?.[localHomeId] ?? localHomeId,
          away_team_id: teamIdMap?.[localAwayId] ?? localAwayId,
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
      .order("date")
      .order("time")
      .order("id");

    return NextResponse.json({ success: true, fixtures: synced });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
