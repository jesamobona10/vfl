import { enqueuePublicPush } from "@/lib/public-push";
import { livePhase, liveSettings } from "@/lib/logic/live";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { asInteger, getClientIp, json, logApiError, rateLimit, rateLimitResponse } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const fixtureId = asInteger(params.id, 1);
  if (!fixtureId) return json({ error: "Invalid match id." }, { status: 400 });

  const ip = getClientIp(request);
  const limited = await rateLimit({ key: `public-halftime:${ip}:${fixtureId}`, limit: 4, windowMs: 60_000 });
  if (limited.limited) return rateLimitResponse(limited.resetAt);

  try {
    const supabase = createServiceRoleClient();
    const { data: fixture, error } = await supabase
      .from("fixtures")
      .select("id, status, live_started_at, home_score, away_score, home_team_id, away_team_id, competition_id, halftime_notified_at")
      .eq("id", fixtureId)
      .maybeSingle();

    if (error) throw error;
    if (
      !fixture ||
      (fixture.status !== "live" && fixture.status !== "in-progress") ||
      !fixture.live_started_at ||
      fixture.halftime_notified_at
    ) {
      return json({ notified: false });
    }

    let competitionSettings = {};
    if (fixture.competition_id) {
      const { data: competition } = await supabase
        .from("competitions")
        .select("settings")
        .eq("id", fixture.competition_id)
        .maybeSingle();
      competitionSettings = competition?.settings || {};
    }
    const phase = livePhase(
      fixture.live_started_at,
      Date.now(),
      liveSettings(competitionSettings)
    );
    if (phase.label !== "HT") return json({ notified: false });

    const { data: claimed, error: claimError } = await supabase
      .from("fixtures")
      .update({ halftime_notified_at: new Date().toISOString() })
      .eq("id", fixtureId)
      .is("halftime_notified_at", null)
      .select("id")
      .maybeSingle();

    if (claimError) throw claimError;
    if (!claimed) return json({ notified: false });

    const { data: teams } = await supabase
      .from("teams")
      .select("id, name")
      .in("id", [fixture.home_team_id, fixture.away_team_id]);
    const homeTeam = teams?.find((team) => team.id === fixture.home_team_id)?.name || "Home";
    const awayTeam = teams?.find((team) => team.id === fixture.away_team_id)?.name || "Away";
    enqueuePublicPush({
      title: "Half-time",
      body: `${homeTeam} ${fixture.home_score ?? 0}–${fixture.away_score ?? 0} ${awayTeam} at half-time.`,
      matchId: fixtureId,
    });
    return json({ notified: true });
  } catch (error) {
    logApiError("public_halftime_notification_failed", error, { fixtureId });
    return json({ error: "Unable to process half-time update." }, { status: 500 });
  }
}
