import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  actorRole,
  asInteger,
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  parseJsonObject,
  rateLimit,
  rateLimitResponse,
  requireOrgAdmin,
  writeAuditRecord,
} from "@/lib/security";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { loadFixtureContext, buildMatchContext } from "@/lib/ai/context-loader";
import {
  computeScore,
  eventTypeToMatchEventType,
  validateEvents,
} from "@/lib/ai/event-validation";
import type { CandidateEvent } from "@/lib/ai/event-validation";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string; analysisId: string }> }
) {
  const params = await props.params;
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    if (!auth) return json({ error: "Unauthorized" }, { status: 401 });
    const authed = auth;

    const ip = getClientIp(request);
    const limited = await rateLimit({
      key: `report:confirm:${ip}:${authed.userId}`,
      limit: 30,
      windowMs: 60 * 60_000,
    });
    if (limited.limited) return rateLimitResponse(limited.resetAt);

    const fixtureId = asInteger(params.id, 1);
    const analysisId = asInteger(params.analysisId, 1);
    if (!fixtureId || !analysisId) {
      return json({ error: "Invalid fixture or analysis id." }, { status: 400 });
    }

    const loaded = await loadFixtureContext(supabase, fixtureId);
    if (!loaded) return json({ error: "Fixture not found." }, { status: 404 });

    const { homeOrgId, awayOrgId } = loaded;
    const orgId = homeOrgId || awayOrgId;
    if (homeOrgId !== awayOrgId) {
      return json({ error: "Fixture teams belong to different organizations." }, { status: 400 });
    }
    if (!orgId) {
      return json({ error: "Fixture teams are not organization-scoped." }, { status: 400 });
    }
    if (!authed.isAdmin) {
      const adminError = requireOrgAdmin(authed, orgId);
      if (adminError) return adminError;
    }

    const sb = createServiceRoleClient();
    const { data: analysis, error: fetchError } = await sb
      .from("match_report_analyses")
      .select("*")
      .eq("id", analysisId)
      .eq("match_id", fixtureId)
      .maybeSingle();

    if (fetchError || !analysis) {
      return json({ error: "Analysis not found." }, { status: 404 });
    }
    if (analysis.status === "CONFIRMED") {
      return json({ error: "This analysis has already been confirmed." }, { status: 400 });
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });
    const rawEvents = parsed.data!.events;

    // The FA submits the final approved event list; we re-validate it
    // deterministically and refuse to confirm anything invalid.
    if (!Array.isArray(rawEvents)) {
      return json({ error: "events must be an array." }, { status: 400 });
    }

    const context = buildMatchContext(loaded.context);

    // SECURITY: never trust client-supplied validation flags or resolution
    // statuses. Re-run deterministic validation on the server; anything that
    // fails business rules (type whitelist, minutes, team membership) here
    // refuses confirmation.
    const approved = validateEvents(rawEvents as CandidateEvent[], context).events;

    const invalid = approved.filter((e) => !e.validation.valid);
    if (invalid.length > 0) {
      return json(
        {
          error: "Cannot confirm: some events are invalid.",
          details: invalid.map((e) => ({
            type: e.type,
            minute: e.minute,
            errors: e.validation.errors,
          })),
        },
        { status: 400 }
      );
    }
    const unresolved = approved.filter(
      (e) => e.playerId == null || e.teamId == null || e.playerStatus !== "RESOLVED"
    );
    if (unresolved.length > 0) {
      return json(
        { error: "Cannot confirm: some events are unresolved. Resolve them first." },
        { status: 400 }
      );
    }

    // Verify every referenced player exists and actually belongs to the team
    // claimed by the event (the client could assert any player/team pair).
    const referencedPlayerIds = Array.from(
      new Set(
        approved.flatMap((e) =>
          e.assistPlayerId != null ? [e.playerId!, e.assistPlayerId] : [e.playerId!]
        )
      )
    );
    const { data: rosterRows, error: rosterError } = await sb
      .from("players")
      .select("id, team_id")
      .in("id", referencedPlayerIds);
    if (rosterError) {
      logApiError("report_confirm_roster_lookup_failed", rosterError, {
        userId: authed.userId,
        fixtureId,
      });
      return json({ error: "Unable to verify players." }, { status: 500 });
    }
    const rosterTeam = new Map<number, number>(
      (rosterRows || []).map((p: { id: number; team_id: number }) => [p.id, p.team_id])
    );
    for (const ev of approved) {
      if (rosterTeam.get(ev.playerId!) !== ev.teamId) {
        return json(
          {
            error: `Cannot confirm: player ${ev.playerId} does not belong to team ${ev.teamId}.`,
          },
          { status: 400 }
        );
      }
      const isGoalWithAssist =
        (ev.type === "GOAL" || ev.type === "PENALTY_GOAL") && ev.assistPlayerId != null;
      if (isGoalWithAssist) {
        if (rosterTeam.get(ev.assistPlayerId!) !== ev.teamId) {
          return json(
            {
              error: `Cannot confirm: assisting player ${ev.assistPlayerId} does not belong to team ${ev.teamId}.`,
            },
            { status: 400 }
          );
        }
      }
    }

    // --- Apply the confirmed events atomically-ish (per-guide, all writes
    // --- happen here, after FA confirmation). Supabase service-role ops.
    let eventsInserted = 0;
    const statBumps = new Map<
      number,
      { goals: number; assists: number; yellows: number; reds: number }
    >();

    const bump = (playerId: number, field: "goals" | "assists" | "yellows" | "reds") => {
      const cur = statBumps.get(playerId) || { goals: 0, assists: 0, yellows: 0, reds: 0 };
      cur[field] += 1;
      statBumps.set(playerId, cur);
    };

    for (const ev of approved) {
      if (ev.playerId == null || ev.teamId == null) continue;
      const matchEventType = eventTypeToMatchEventType(ev.type);
      const minute = ev.minute ?? null;

      // Insert the primary match_event row.
      const { error: evError } = await sb.from("match_events").insert({
        match_id: fixtureId,
        player_id: ev.playerId,
        team_id: ev.teamId,
        event_type: matchEventType,
        minute,
      });
      if (evError) {
        logApiError("report_confirm_event_failed", evError, { userId: authed.userId, fixtureId });
        return json({ error: "Unable to save confirmed events." }, { status: 400 });
      }
      eventsInserted += 1;

      if (matchEventType === "goal") {
        bump(ev.playerId, "goals");
      } else if (matchEventType === "own-goal") {
        // Own goal: opponent scores; no player goal stat (schema matches app).
      } else if (matchEventType === "yellow") {
        bump(ev.playerId, "yellows");
      } else if (matchEventType === "red") {
        bump(ev.playerId, "reds");
      }

      // Assist is stored as its own match_event row (app convention) when present.
      if ((ev.type === "GOAL" || ev.type === "PENALTY_GOAL") && ev.assistPlayerId != null) {
        const { error: assistError } = await sb.from("match_events").insert({
          match_id: fixtureId,
          player_id: ev.assistPlayerId,
          team_id: ev.teamId,
          event_type: "assist",
          minute,
        });
        if (assistError) {
          logApiError("report_confirm_assist_failed", assistError, {
            userId: authed.userId,
            fixtureId,
          });
          return json({ error: "Unable to save assists." }, { status: 400 });
        }
        eventsInserted += 1;
        bump(ev.assistPlayerId, "assists");
      }
    }

    // Update denormalized player stat columns (mirrors AddEventModal flow).
    for (const [playerId, b] of statBumps) {
      if (!b.goals && !b.assists && !b.yellows && !b.reds) continue;
      const { data: player } = await sb
        .from("players")
        .select("goals, assists, yellow_cards, red_cards")
        .eq("id", playerId)
        .single();
      const { error: statError } = await sb
        .from("players")
        .update({
          goals: (player?.goals ?? 0) + b.goals,
          assists: (player?.assists ?? 0) + b.assists,
          yellow_cards: (player?.yellow_cards ?? 0) + b.yellows,
          red_cards: (player?.red_cards ?? 0) + b.reds,
        })
        .eq("id", playerId);
      if (statError && !player) {
        logApiError("report_confirm_stats_failed", statError, {
          userId: authed.userId,
          fixtureId,
          playerId,
        });
      }
    }

    // Recompute score from the confirmed goal events and update the fixture.
    const score = computeScore(approved, context);
    const homeScore = score.homeScore ?? loaded.context.fixture.home_score ?? 0;
    const awayScore = score.awayScore ?? loaded.context.fixture.away_score ?? 0;

    const { error: fixtureError } = await sb
      .from("fixtures")
      .update({
        home_score: homeScore,
        away_score: awayScore,
        status: "completed",
      })
      .eq("id", fixtureId);
    if (fixtureError) {
      logApiError("report_confirm_fixture_failed", fixtureError, {
        userId: authed.userId,
        fixtureId,
      });
      return json({ error: "Unable to update match score." }, { status: 400 });
    }

    const { error: markError } = await sb
      .from("match_report_analyses")
      .update({
        status: "CONFIRMED",
        score,
        events: approved,
        updated_at: new Date().toISOString(),
      })
      .eq("id", analysisId);
    if (markError) {
      logApiError("report_confirm_mark_failed", markError, { userId: authed.userId, fixtureId });
      return json(
        { error: "Events saved but analysis could not be marked confirmed." },
        { status: 400 }
      );
    }

    void writeAuditRecord({
      organizationId: orgId,
      actorId: authed.userId,
      actorRole: actorRole(authed),
      action: AUDIT_ACTIONS.MATCH_EVENTS_CONFIRMED,
      resourceType: "MATCH",
      resourceId: fixtureId,
      description: `Confirmed ${eventsInserted} match events for fixture #${fixtureId} (${homeScore} - ${awayScore})`,
      metadata: {
        analysisId,
        eventsInserted,
        homeScore,
        awayScore,
        requiresReview: analysis.status === "REVIEW_REQUIRED",
      },
      ip,
    }).catch(() => {});

    return json({
      success: true,
      fixtureId,
      homeScore,
      awayScore,
      eventsInserted,
      analysisId,
    });
  } catch (error) {
    logApiError("report_confirm_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
