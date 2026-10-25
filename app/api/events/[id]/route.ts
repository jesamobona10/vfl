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

export const dynamic = "force-dynamic";

async function checkEventOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  authed: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>,
  matchId: number
): Promise<Response | null> {
  const { data: fixture } = await supabase
    .from("fixtures")
    .select("home_team_id, away_team_id")
    .eq("id", matchId)
    .single();

  if (!fixture) return json({ error: "Fixture not found." }, { status: 404 });

  const { data: homeTeam } = await supabase
    .from("teams")
    .select("organization_id")
    .eq("id", fixture.home_team_id)
    .single();

  const { data: awayTeam } = await supabase
    .from("teams")
    .select("organization_id")
    .eq("id", fixture.away_team_id)
    .single();

  if (!homeTeam || !awayTeam) return json({ error: "Team not found." }, { status: 404 });

  const orgId = homeTeam.organization_id;
  const isOrgAdmin = requireOrgAdmin(authed, orgId) === null;
  const isTeamOwner =
    ownsTeam(authed, fixture.home_team_id) || ownsTeam(authed, fixture.away_team_id);

  if (!isOrgAdmin && !isTeamOwner) {
    return json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;
    const authed = auth!;

    const ip = getClientIp(request);
    const limited = await rateLimit({
      key: `events:delete:${ip}:${authed.userId}`,
      limit: 60,
      windowMs: 60 * 60_000,
    });
    if (limited.limited) return rateLimitResponse(limited.resetAt);

    const url = new URL(request.url);
    const eventIdParam = asInteger(params.id, 1);
    const matchId = asInteger(url.searchParams.get("match_id"), 1);
    // Match event rows may not be selectable through the caller's RLS policy.
    // Read them with service role only after authenticating; every operation
    // below still verifies that the caller can manage the owning fixture.
    const sb = createServiceRoleClient();

    if (eventIdParam) {
      const { data: event, error: eventLookupError } = await sb
        .from("match_events")
        .select("match_id, event_type")
        .eq("id", eventIdParam)
        .maybeSingle();

      if (eventLookupError) {
        logApiError("event_delete_lookup_failed", eventLookupError, { userId: authed.userId, eventId: eventIdParam });
        return json({ error: "Unable to find event." }, { status: 500 });
      }
      if (!event) return json({ error: "Event not found." }, { status: 404 });

      const ownershipError = await checkEventOwnership(supabase, authed, event.match_id);
      if (ownershipError) return ownershipError;

      // Delete via the service-role client: the API has already authorized the
      // caller (org admin or team owner), but the RLS delete policy only allows
      // org-level admins, so a coach's delete would otherwise silently affect
      // zero rows and still report success.
      if (event.event_type === "goal") {
        const { data: scoreRows, error: goalDeleteError } = await sb.rpc("delete_match_goal", { p_event_id: eventIdParam });
        if (goalDeleteError) {
          logApiError("goal_delete_failed", goalDeleteError, { userId: authed.userId, eventId: eventIdParam });
          return json({ error: "Unable to remove goal." }, { status: 400 });
        }
        const score = Array.isArray(scoreRows) ? scoreRows[0] : null;
        return json({ success: true, scoreline: score ? { homeScore: score.home_score, awayScore: score.away_score } : null });
      }
      const { data: deleted, error } = await sb
        .from("match_events")
        .delete()
        .eq("id", eventIdParam)
        .select("id");

      if (error) {
        logApiError("event_delete_failed", error, { userId: authed.userId, eventId: eventIdParam });
        return json({ error: "Unable to delete event." }, { status: 400 });
      }
      if (!deleted || deleted.length === 0) {
        return json({ error: "Event not found." }, { status: 404 });
      }
      return json({ success: true });
    }

    if (!matchId) {
      return json({ error: "Provide event id, or match_id + player_id + type." }, { status: 400 });
    }

    const ownershipError = await checkEventOwnership(supabase, authed, matchId);
    if (ownershipError) return ownershipError;

    const playerId = asInteger(url.searchParams.get("player_id"), 1);
    const eventType = asString(url.searchParams.get("type"), 30);

    if (!playerId || !eventType) {
      return json({ error: "Provide event id, or match_id + player_id + type." }, { status: 400 });
    }

    const { data: existing, error: existingLookupError } = await sb
      .from("match_events")
      .select("id")
      .eq("match_id", matchId)
      .eq("player_id", playerId)
      .eq("event_type", eventType)
      .limit(1);

    if (existingLookupError) {
      logApiError("event_delete_lookup_failed", existingLookupError, { userId: authed.userId, matchId });
      return json({ error: "Unable to find event." }, { status: 500 });
    }
    if (!existing || existing.length === 0) {
      return json({ error: "Event not found." }, { status: 404 });
    }

    const { data: deletedByKey, error } = await sb
      .from("match_events")
      .delete()
      .eq("id", existing[0].id)
      .select("id");

    if (error) {
      logApiError("event_delete_failed", error, { userId: authed.userId });
      return json({ error: "Unable to delete event." }, { status: 400 });
    }
    if (!deletedByKey || deletedByKey.length === 0) {
      return json({ error: "Event not found." }, { status: 404 });
    }

    return json({ success: true });
  } catch (error) {
    logApiError("event_delete_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await createClient();
    const auth = await getAuthContext(session);
    const authError = requireAuth(auth);
    if (authError) return authError;
    const eventId = asInteger(params.id, 1);
    if (!eventId) return json({ error: "Invalid event id." }, { status: 400 });
    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });
    const playerId = asInteger(parsed.data?.playerId ?? parsed.data?.player_id, 1);
    if (!playerId) return json({ error: "Select a player." }, { status: 400 });

    const sb = createServiceRoleClient();
    const { data: event } = await sb
      .from("match_events")
      .select("id, match_id, player_id, team_id, event_type")
      .eq("id", eventId)
      .maybeSingle();
    if (!event) return json({ error: "Event not found." }, { status: 404 });
    const ownershipError = await checkEventOwnership(session, auth!, event.match_id);
    if (ownershipError) return ownershipError;
    if (event.event_type !== "goal") return json({ error: "Only goals can be attributed after the match." }, { status: 400 });
    if (event.player_id != null) return json({ error: "This event already has a player assigned." }, { status: 409 });
    if (!event.team_id) return json({ error: "This event has no team to assign a player from." }, { status: 400 });

    const { data: player } = await sb
      .from("players")
      .select("id, name")
      .eq("id", playerId)
      .eq("team_id", event.team_id)
      .maybeSingle();
    if (!player) return json({ error: "Choose a player from the scoring team." }, { status: 400 });

    const { data: updated, error } = await sb
      .from("match_events")
      .update({ player_id: playerId })
      .eq("id", eventId)
      .is("player_id", null)
      .select("id, player_id, team_id, event_type, minute")
      .maybeSingle();
    if (error) {
      logApiError("event_attribution_failed", error, { userId: auth!.userId, eventId });
      return json({ error: "Unable to assign player to event." }, { status: 500 });
    }
    if (!updated) return json({ error: "This event has already been updated." }, { status: 409 });
    return json({ event: updated, playerName: player.name });
  } catch (error) {
    logApiError("event_attribution_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
