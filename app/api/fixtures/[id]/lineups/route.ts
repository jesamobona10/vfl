import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { fixtureKickoffUtc } from "@/lib/public-reminders";
import { MATCH_FORMATIONS } from "@/lib/match-lineups";
import {
  actorRole, asInteger, getAuthContext, getClientIp, json, logApiError,
  logSecurityEvent, parseJsonObject, rateLimit, rateLimitResponse, requireAuth,
  requireOrgAdmin, writeAuditEvent,
} from "@/lib/security";

export const dynamic = "force-dynamic";

async function getFixtureLineupContext(id: string) {
  const fixtureId = asInteger(id, 1);
  if (!fixtureId) return { response: json({ error: "Invalid fixture id." }, { status: 400 }) };
  const session = await createClient();
  const auth = await getAuthContext(session);
  const authError = requireAuth(auth);
  if (authError) return { response: authError };
  const service = createServiceRoleClient();
  const { data: fixture, error: fixtureError } = await service
    .from("fixtures")
    .select("id, date, time, status, home_team_id, away_team_id")
    .eq("id", fixtureId)
    .maybeSingle();
  if (fixtureError) return { response: json({ error: "Unable to load fixture." }, { status: 500 }) };
  if (!fixture) return { response: json({ error: "Fixture not found." }, { status: 404 }) };
  const { data: teams, error: teamsError } = await service
    .from("teams")
    .select("id, name, logo_url, organization_id")
    .in("id", [fixture.home_team_id, fixture.away_team_id]);
  if (teamsError) return { response: json({ error: "Unable to load fixture teams." }, { status: 500 }) };
  const home = teams?.find((team) => team.id === fixture.home_team_id);
  const away = teams?.find((team) => team.id === fixture.away_team_id);
  if (!home || !away || !home.organization_id || home.organization_id !== away.organization_id) {
    return { response: json({ error: "Fixture organization could not be resolved." }, { status: 404 }) };
  }
  const canReview = requireOrgAdmin(auth, home.organization_id) === null;
  const coachTeamId = auth!.teamAccount?.team_id;
  const canSubmitTeamId = coachTeamId === home.id || coachTeamId === away.id ? coachTeamId : null;
  if (!canReview && !canSubmitTeamId) return { response: json({ error: "Forbidden." }, { status: 403 }) };
  const timezone = process.env.PUBLIC_MATCH_TIMEZONE || "Africa/Lagos";
  const kickoff = fixture.date && fixture.time ? fixtureKickoffUtc(fixture.date, fixture.time, timezone) : null;
  const now = new Date();
  const opensAt = kickoff ? new Date(kickoff.getTime() - 2 * 60 * 60_000) : null;
  const canSubmit = Boolean(
    canSubmitTeamId && fixture.status === "scheduled" && kickoff && opensAt && now >= opensAt && now < kickoff
  );
  return { fixtureId, fixture, home, away, organizationId: home.organization_id, auth: auth!, service, canReview, canSubmitTeamId, canSubmit, kickoff, opensAt };
}

function submissionWindowMessage(context: { opensAt: Date | null; kickoff: Date | null }) {
  if (!context.kickoff || !context.opensAt) return "This fixture needs a scheduled date and time before lineups can be submitted.";
  if (Date.now() < context.opensAt.getTime()) return "Lineup submission opens two hours before kickoff.";
  if (Date.now() >= context.kickoff.getTime()) return "Lineups can no longer be changed after kickoff.";
  return "This fixture is not accepting lineup submissions.";
}

async function hydrateLineups(rows: any[], service: ReturnType<typeof createServiceRoleClient>) {
  const playerIds = [...new Set(rows.flatMap((row) => [
    ...(Array.isArray(row.starting_xi) ? row.starting_xi : []).map((slot: any) => slot.playerId),
    ...(Array.isArray(row.substitutes) ? row.substitutes : []),
  ]).filter((id): id is number => Number.isInteger(id)))];
  const { data: players } = playerIds.length
    ? await service.from("players").select("id, name, jersey_number, photo_url, position").in("id", playerIds)
    : { data: [] };
  const playersById = new Map((players || []).map((player) => [player.id, player]));
  return rows.map((row) => ({
    id: row.id,
    team_id: row.team_id,
    formation: row.formation,
    status: row.status,
    submitted_at: row.submitted_at,
    reviewed_at: row.reviewed_at,
    reviewed_by: row.reviewed_by,
    review_note: row.review_note,
    starting_xi: (Array.isArray(row.starting_xi) ? row.starting_xi : []).map((slot: any) => ({
      ...slot,
      player: playersById.get(slot.playerId) || null,
    })),
    substitutes: (Array.isArray(row.substitutes) ? row.substitutes : []).map((id: number) => playersById.get(id)).filter(Boolean),
  }));
}

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const context = await getFixtureLineupContext((await props.params).id);
  if (context.response) return context.response;
  const { data, error } = await context.service.from("fixture_lineups").select("*").eq("fixture_id", context.fixtureId).order("team_id");
  if (error) {
    logApiError("fixture_lineups_list_failed", error, { fixtureId: context.fixtureId });
    return json({ error: "Unable to load match lineups." }, { status: 500 });
  }
  const visibleRows = (data || []).filter((row) =>
    context.canReview || row.team_id === context.canSubmitTeamId || row.status === "approved"
  );
  const lineups = await hydrateLineups(visibleRows, context.service);
  const { data: roster } = context.canSubmitTeamId
    ? await context.service.from("players").select("id, name, jersey_number, photo_url, position").eq("team_id", context.canSubmitTeamId).order("jersey_number", { ascending: true, nullsFirst: true }).order("name")
    : { data: [] };
  return json({
    fixture: { id: context.fixture.id, date: context.fixture.date, time: context.fixture.time, status: context.fixture.status },
    teams: [context.home, context.away].map((team) => ({ id: team.id, name: team.name, logo_url: team.logo_url })),
    lineups,
    roster: roster || [],
    canReview: context.canReview,
    canSubmitTeamId: context.canSubmitTeamId,
    canSubmit: context.canSubmit,
    opensAt: context.opensAt?.toISOString() || null,
    kickoff: context.kickoff?.toISOString() || null,
    timezone: process.env.PUBLIC_MATCH_TIMEZONE || "Africa/Lagos",
  });
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const context = await getFixtureLineupContext((await props.params).id);
  if (context.response) return context.response;
  if (!context.canSubmitTeamId || context.auth.teamAccount?.team_id !== context.canSubmitTeamId) {
    return json({ error: "Only the team account for this fixture can submit its lineup." }, { status: 403 });
  }
  const limited = await rateLimit({ key: `fixture-lineup:${getClientIp(request)}:${context.auth.userId}`, limit: 20, windowMs: 60 * 60_000 });
  if (limited.limited) return rateLimitResponse(limited.resetAt);
  if (!context.canSubmit) return json({ error: submissionWindowMessage(context) }, { status: 403 });
  const parsed = await parseJsonObject(request);
  if (parsed.error) return json({ error: parsed.error }, { status: 400 });
  const body = parsed.data!;
  const formation = typeof body.formation === "string" ? body.formation : "";
  const expectedSlots = MATCH_FORMATIONS[formation];
  const starters = Array.isArray(body.starting_xi) ? body.starting_xi : [];
  const substitutes = Array.isArray(body.substitutes) ? body.substitutes : [];
  if (!expectedSlots || starters.length !== 11 || starters.some((slot: any, index: number) =>
    !slot || slot.slotId !== expectedSlots[index].slotId || !Number.isInteger(slot.playerId)
  )) return json({ error: "Choose a supported formation and all eleven starting players." }, { status: 400 });
  const starterIds = starters.map((slot: any) => slot.playerId);
  const substituteIds = substitutes.map(Number);
  if (new Set([...starterIds, ...substituteIds]).size !== starterIds.length + substituteIds.length || substituteIds.length > 12 || substituteIds.some((id: number) => !Number.isInteger(id))) {
    return json({ error: "Players must be unique and the substitutes list cannot exceed twelve players." }, { status: 400 });
  }
  const allPlayerIds = [...starterIds, ...substituteIds];
  const { data: roster, error: rosterError } = await context.service.from("players").select("id").eq("team_id", context.canSubmitTeamId).in("id", allPlayerIds);
  if (rosterError) return json({ error: "Unable to verify team players." }, { status: 500 });
  if ((roster || []).length !== allPlayerIds.length) return json({ error: "Every selected player must belong to your team roster." }, { status: 400 });
  const normalizedStarters = expectedSlots.map((slot, index) => ({ ...slot, playerId: starters[index].playerId }));
  const { data, error } = await context.service.from("fixture_lineups").upsert({
    fixture_id: context.fixtureId,
    team_id: context.canSubmitTeamId,
    organization_id: context.organizationId,
    formation,
    starting_xi: normalizedStarters,
    substitutes: substituteIds,
    status: "pending",
    submitted_by: context.auth.userId,
    submitted_at: new Date().toISOString(),
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "fixture_id,team_id" }).select("*").single();
  if (error || !data) {
    logApiError("fixture_lineup_submit_failed", error, { fixtureId: context.fixtureId, teamId: context.canSubmitTeamId });
    return json({ error: "Unable to submit lineup." }, { status: 500 });
  }
  logSecurityEvent("fixture_lineup_submitted", { fixtureId: context.fixtureId, teamId: context.canSubmitTeamId, userId: context.auth.userId });
  return json({ lineup: (await hydrateLineups([data], context.service))[0] }, { status: 201 });
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const context = await getFixtureLineupContext((await props.params).id);
  if (context.response) return context.response;
  if (!context.canReview) return json({ error: "Organization or FA administrator access is required." }, { status: 403 });
  const parsed = await parseJsonObject(request);
  if (parsed.error) return json({ error: parsed.error }, { status: 400 });
  const lineupId = typeof parsed.data!.lineupId === "string" ? parsed.data!.lineupId : "";
  const status = parsed.data!.status;
  const reviewNote = typeof parsed.data!.reviewNote === "string" ? parsed.data!.reviewNote.trim().slice(0, 500) : null;
  if (!/^[0-9a-f-]{36}$/i.test(lineupId) || !["approved", "rejected"].includes(String(status))) {
    return json({ error: "Choose a lineup and approve or reject it." }, { status: 400 });
  }
  const { data: existing } = await context.service.from("fixture_lineups").select("team_id, status").eq("id", lineupId).eq("fixture_id", context.fixtureId).maybeSingle();
  if (!existing) return json({ error: "Lineup not found." }, { status: 404 });
  if (existing.status !== "pending") return json({ error: "Only pending lineups can be reviewed." }, { status: 409 });
  const { data, error } = await context.service.from("fixture_lineups").update({
    status,
    reviewed_by: context.auth.userId,
    reviewed_at: new Date().toISOString(),
    review_note: reviewNote,
    updated_at: new Date().toISOString(),
  }).eq("id", lineupId).eq("fixture_id", context.fixtureId).select("*").single();
  if (error || !data) {
    logApiError("fixture_lineup_review_failed", error, { fixtureId: context.fixtureId, lineupId });
    return json({ error: "Unable to review lineup." }, { status: 500 });
  }
  void writeAuditEvent("FIXTURE_LINEUP_REVIEWED", context.auth.userId, context.organizationId, {
    fixture_id: context.fixtureId, team_id: existing.team_id, lineup_id: lineupId, status,
    actor_role: actorRole(context.auth), review_note: reviewNote,
  });
  return json({ lineup: (await hydrateLineups([data], context.service))[0] });
}
