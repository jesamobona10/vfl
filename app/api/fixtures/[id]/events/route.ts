import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  asInteger,
  asString,
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  ownsTeam,
  parseJsonObject,
  rateLimit,
  rateLimitResponse,
  requireAuth,
  requireOrgAdmin,
} from "@/lib/security";
import { enqueuePublicPush } from "@/lib/public-push";

export const dynamic = "force-dynamic";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;
    const authed = auth!;

    const ip = getClientIp(request);
    const limited = await rateLimit({
      key: `events:create:${ip}:${authed.userId}`,
      limit: 120,
      windowMs: 60 * 60_000,
    });
    if (limited.limited) return rateLimitResponse(limited.resetAt);

    const fixtureId = asInteger(params.id, 1);
    if (!fixtureId) return json({ error: "Invalid fixture id." }, { status: 400 });

    const { data: fixture } = await supabase
      .from("fixtures")
      .select("home_team_id, away_team_id, competition_id, season_id")
      .eq("id", fixtureId)
      .single();

    if (!fixture) return json({ error: "Fixture not found." }, { status: 404 });

    const homeTeamId = fixture.home_team_id;
    const awayTeamId = fixture.away_team_id;
    const competitionId = fixture.competition_id || null;
    const seasonId = fixture.season_id || null;

    const { data: homeTeam } = await supabase
      .from("teams")
      .select("organization_id, name")
      .eq("id", homeTeamId)
      .single();

    const { data: awayTeam } = await supabase
      .from("teams")
      .select("organization_id, name")
      .eq("id", awayTeamId)
      .single();

    if (!homeTeam || !awayTeam) {
      return json({ error: "Team not found." }, { status: 404 });
    }

    const homeOrgId = homeTeam.organization_id;
    const awayOrgId = awayTeam.organization_id;

    if (homeOrgId !== awayOrgId) {
      return json({ error: "Fixture teams belong to different organizations." }, { status: 400 });
    }

    const isOrgAdmin = requireOrgAdmin(authed, homeOrgId) === null;
    const isTeamOwner = ownsTeam(authed, homeTeamId) || ownsTeam(authed, awayTeamId);

    if (!isOrgAdmin && !isTeamOwner) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const playerId = asInteger(parsed.data!.player_id ?? parsed.data!.playerId, 1);
    const teamId = asInteger(parsed.data!.team_id ?? parsed.data!.teamId, 1);
    const eventType = asString(parsed.data!.type ?? parsed.data!.event_type, 30);
    const minute = asInteger(parsed.data!.minute, 1, 150);

    if (!playerId) return json({ error: "Player ID is required." }, { status: 400 });
    if (!teamId) return json({ error: "Team ID is required." }, { status: 400 });
    if (!eventType) return json({ error: "Event type is required." }, { status: 400 });

    const ALLOWED_EVENT_TYPES = [
      "goal", "assist", "own-goal", "yellow", "red", "save", "penalty-save",
      "clean-sheet", "motm", "error", "penalty-conceded", "tackle", "interception",
      "block", "aerial", "goal-conceded", "match-win", "bonus-5-saves",
    ];
    if (!ALLOWED_EVENT_TYPES.includes(eventType)) {
      return json({ error: `Invalid event type. Allowed: ${ALLOWED_EVENT_TYPES.join(", ")}` }, { status: 400 });
    }

    if (teamId !== homeTeamId && teamId !== awayTeamId) {
      return json({ error: "Team does not participate in this fixture." }, { status: 400 });
    }

    const { data: player } = await supabase
      .from("players")
      .select("id, name")
      .eq("id", playerId)
      .eq("team_id", teamId)
      .maybeSingle();

    if (!player) {
      return json({ error: "Player not found on the specified team." }, { status: 400 });
    }

    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("match_events")
      .insert({
        match_id: fixtureId,
        player_id: playerId,
        team_id: teamId,
        event_type: eventType,
        minute: minute || null,
        competition_id: competitionId,
        season_id: seasonId,
        organization_id: homeOrgId,
      })
      .select()
      .single();

    if (error) {
      logApiError("event_create_failed", error, { userId: authed.userId, fixtureId });
      return json({ error: "Unable to save event." }, { status: 400 });
    }

    const scoringTeamName = teamId === homeTeamId ? homeTeam.name : awayTeam.name;
    const subject = player.name || "A player";
    const eventDescription: Record<string, string> = {
      goal: `${subject} scored for ${scoringTeamName}.`,
      assist: `${subject} assisted ${scoringTeamName}.`,
      "own-goal": `${subject} scored an own goal for ${scoringTeamName}.`,
      yellow: `${subject} received a yellow card for ${scoringTeamName}.`,
      red: `${subject} received a red card for ${scoringTeamName}.`,
      save: `${subject} made a save for ${scoringTeamName}.`,
      "penalty-save": `${subject} saved a penalty for ${scoringTeamName}.`,
      "clean-sheet": `${scoringTeamName} kept a clean sheet.`,
      motm: `${subject} was named player of the match for ${scoringTeamName}.`,
      error: `${subject} made an error for ${scoringTeamName}.`,
      "penalty-conceded": `${subject} conceded a penalty for ${scoringTeamName}.`,
      "goal-conceded": `${scoringTeamName} conceded a goal.`,
      tackle: `${subject} made a tackle for ${scoringTeamName}.`,
      interception: `${subject} made an interception for ${scoringTeamName}.`,
      block: `${subject} made a block for ${scoringTeamName}.`,
      aerial: `${subject} won an aerial duel for ${scoringTeamName}.`,
      "match-win": `${scoringTeamName} won the match.`,
      "bonus-5-saves": `${subject} reached five saves for ${scoringTeamName}.`,
    };
    enqueuePublicPush({
      title: eventType === "goal" || eventType === "own-goal" ? "Goal scored" : "Match update",
      body: `${eventDescription[eventType]}${minute ? ` ${minute}′` : ""}`,
      matchId: fixtureId,
    });

    return json({ event: data });
  } catch (error) {
    logApiError("event_create_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
