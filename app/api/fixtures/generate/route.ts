import { createClient } from "@/lib/supabase/server";
import { generateRoundRobinFixtures } from "@/lib/logic/round-robin";
import { getAuthContext, json, logApiError, requireAdmin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("id, name")
      .order("id");

    if (teamsError || !teams?.length) {
      return json(
        { error: "No teams found." },
        { status: 400 }
      );
    }

    const { data: existing } = await supabase
      .from("fixtures")
      .select("id")
      .limit(1);

    if (existing && existing.length > 0) {
      return json(
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
      logApiError("fixtures_generate_insert_failed", insertError, { userId: auth!.userId });
      return json({ error: "Unable to generate fixtures." }, { status: 500 });
    }

    return json({ success: true, count: rows.length });
  } catch (error) {
    logApiError("fixtures_generate_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
