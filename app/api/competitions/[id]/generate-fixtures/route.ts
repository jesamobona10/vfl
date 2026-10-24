import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  getAuthContext,
  actorRole,
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  rateLimit,
  rateLimitResponse,
  requireAuth,
  requireOrgAdmin,
  writeAuditRecord,
} from "@/lib/security";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { generateFriendlyFixtures, generateRoundRobinFixtures, completeSingleRoundRobin } from "@/lib/logic/round-robin";
import { pairKey } from "@/lib/utils/helpers";
import { ensureCurrentOrgSeason } from "@/lib/season-org";
import { requireSeasonEntitlementForCompetitionSeason } from "@/lib/entitlements";
import type { Team, FixtureRound, Match } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const ip = getClientIp(request);
    const limited = await rateLimit({ key: `comp_generate_fixtures:${ip}`, limit: 5, windowMs: 60_000 });
    if (limited.limited) return rateLimitResponse(limited.resetAt);
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;

    const sb = createServiceRoleClient();

    const { data: competition } = await sb
      .from("competitions")
      .select("*")
      .eq("id", params.id)
      .single();

    if (!competition) {
      return json({ error: "Competition not found." }, { status: 404 });
    }

    const adminError = requireOrgAdmin(auth, competition.organization_id);
    if (adminError) {
      logSecurityEvent("fixture_generate_forbidden", {
        userId: auth?.userId,
        competitionId: params.id,
        organizationId: competition.organization_id,
      });
      return adminError;
    }

    if (!["league", "cup", "friendly"].includes(competition.type)) {
      return json(
        { error: "Fixtures cannot be generated for this competition type." },
        { status: 400 }
      );
    }

    let seasonId: string | null = null;
    let gamesPerTeam = 1;
    let friendlySeed = 1;
    let mode: "create" | "complete" = "create";
    let dryRun = false;
    let requestedSeasonId: string | null = null;
    let startDate: string | null = null;
    let intervalDays: number | null = null;
    try {
      const body = await request.json();
      seasonId = body.season_id || null;
      requestedSeasonId = body.season_id || null;
      if (body.mode === "complete") mode = "complete";
      if (body.dry_run === true || body.dryRun === true) dryRun = true;
      if (typeof body.start_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.start_date)) startDate = body.start_date;
      if (typeof body.interval_days === "number" && Number.isInteger(body.interval_days) && body.interval_days >= 0 && body.interval_days <= 365) {
        intervalDays = body.interval_days;
      }
      if (competition.type === "friendly") {
        if (typeof body.games_per_team === "number" && Number.isFinite(body.games_per_team)) {
          gamesPerTeam = Math.floor(body.games_per_team);
        }
        if (typeof body.seed === "number" && Number.isFinite(body.seed)) {
          friendlySeed = Math.floor(body.seed);
        }
      }
    } catch {
      // body is optional, proceed without it
    }

    if (mode === "complete") {
      if (competition.type !== "league") {
        return json({ error: "Complete schedule is only available for league competitions." }, { status: 400 });
      }
      return handleComplete({
        params,
        auth,
        sb,
        competition,
        ip,
        requestedSeasonId,
        dryRun,
        startDate,
        intervalDays,
      });
    }

    // Entitlement gate: creating fixtures needs an active season. When no
    // season is chosen yet, fall back to the org-wide entitlement.
    const entitlementError = await requireSeasonEntitlementForCompetitionSeason(
      competition.organization_id,
      seasonId
    );
    if (entitlementError) return entitlementError;

    // Resolve season: use explicit season_id, or find/create active season
    if (seasonId) {
      const { data: season } = await sb
        .from("seasons")
        .select("id")
        .eq("id", seasonId)
        .eq("competition_id", params.id)
        .single();
      if (!season) {
        return json(
          { error: "Specified season does not exist for this competition." },
          { status: 400 }
        );
      }
    } else {
      const { data: existingSeason } = await sb
        .from("seasons")
        .select("id")
        .eq("competition_id", params.id)
        .or("is_current.eq.true,status.eq.active")
        .order("is_current", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSeason) {
        seasonId = existingSeason.id;
      } else {
        const year = new Date().getFullYear();
        const orgSeasonId = await ensureCurrentOrgSeason(
          sb,
          competition.organization_id,
          `${year}/${year + 1} Season`
        );
        const { data: newSeason } = await sb
          .from("seasons")
          .insert({
            competition_id: params.id,
            name: `${year}/${year + 1} Season`,
            status: "active",
            is_current: true,
            organization_season_id: orgSeasonId,
          })
          .select("id")
          .single();

        if (!newSeason) {
          return json({ error: "Failed to create season for this competition." }, { status: 500 });
        }
        seasonId = newSeason.id;
      }
    }

    // Idempotency guard: the client disables this button once fixtures exist,
    // but the route must also refuse direct/duplicate calls so a generated
    // calendar is never silently duplicated.
    const { data: existingFixture } = await sb
      .from("fixtures")
      .select("id")
      .eq("season_id", seasonId)
      .eq("competition_id", params.id)
      .limit(1)
      .maybeSingle();

    if (existingFixture) {
      return json(
        {
          error:
            "Fixtures have already been generated for this season. Delete them before regenerating.",
        },
        { status: 409 }
      );
    }

    const { data: seasonTeams } = await sb
      .from("season_teams")
      .select("team:team_id(id, name, rating)")
      .eq("season_id", seasonId)
      .order("team_id");

    if (!seasonTeams || seasonTeams.length < 2) {
      return json(
        { error: "Register at least 2 teams to this season before generating fixtures." },
        { status: 400 }
      );
    }

    const teams: Team[] = seasonTeams.map((st: any) => ({
      id: st.team.id,
      name: st.team.name,
      rating: st.team.rating ?? 6.0,
    }));

    if (competition.type === "friendly") {
      if (gamesPerTeam < 1) gamesPerTeam = 1;
      if (gamesPerTeam > teams.length - 1) {
        return json(
          { error: `Each team can play at most ${teams.length - 1} games.` },
          { status: 400 }
        );
      }
    }

    const rounds =
      competition.type === "friendly"
        ? generateFriendlyFixtures(teams, { gamesPerTeam, seed: friendlySeed })
        : generateRoundRobinFixtures(teams, []);

    const fixtureInserts: any[] = [];
    for (const round of rounds) {
      for (const match of round.matches) {
        fixtureInserts.push({
          competition_id: params.id,
          season_id: seasonId,
          round: match.round,
          home_team_id: match.homeId,
          away_team_id: match.awayId,
          status: "scheduled",
          date: match.date || null,
          time: match.time || null,
          venue: match.venue || null,
        });
      }
    }

    if (fixtureInserts.length > 0) {
      const { error: insertError } = await sb.from("fixtures").insert(fixtureInserts);

      if (insertError) {
        logApiError("fixture_generate_insert_error", insertError);
        return json({ error: "Failed to save fixtures." }, { status: 500 });
      }
    }

    await sb.from("competitions").update({ status: "active" }).eq("id", params.id);

    logSecurityEvent("fixtures_generated", {
      userId: auth?.userId,
      orgId: competition.organization_id,
      competitionId: params.id,
      seasonId,
      roundsCount: rounds.length,
      matchesCount: fixtureInserts.length,
    });
    void writeAuditRecord({
      organizationId: competition.organization_id,
      actorId: auth!.userId,
      actorRole: actorRole(auth),
      action: AUDIT_ACTIONS.FIXTURES_GENERATED,
      resourceType: "FIXTURES",
      resourceId: params.id,
      description: `Generated ${fixtureInserts.length} fixtures across ${rounds.length} rounds`,
      after: {
        competitionId: params.id,
        seasonId,
        roundsCount: rounds.length,
        matchesCount: fixtureInserts.length,
      },
      metadata: { competitionId: params.id, seasonId },
      ip,
    }).catch(() => {});

    return json({
      success: true,
      roundsCount: rounds.length,
      matchesCount: fixtureInserts.length,
    });
  } catch (error) {
    logApiError("fixture_generate_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

function addDays(isoDate: string, days: number): string {
  const base = new Date(`${isoDate}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  const year = base.getUTCFullYear();
  const month = String(base.getUTCMonth() + 1).padStart(2, "0");
  const day = String(base.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function handleComplete({
  params,
  auth,
  sb,
  competition,
  ip,
  requestedSeasonId,
  dryRun,
  startDate,
  intervalDays,
}: {
  params: { id: string };
  auth: any;
  sb: any;
  competition: any;
  ip: string;
  requestedSeasonId: string | null;
  dryRun: boolean;
  startDate: string | null;
  intervalDays: number | null;
}) {
  const { data: fixtures, error: fixturesError } = await sb
    .from("fixtures")
    .select("id, round, home_team_id, away_team_id, status, season_id, competition_id")
    .eq("competition_id", params.id)
    .order("round")
    .order("id");

  if (fixturesError) {
    logApiError("fixture_complete_query_error", fixturesError);
    return json({ error: "Failed to load fixtures." }, { status: 500 });
  }

  if (!fixtures || fixtures.length === 0) {
    return json({ error: "No fixtures to complete." }, { status: 400 });
  }

  for (const f of fixtures as any[]) {
    if (!f.competition_id || f.competition_id !== params.id) {
      return json({ error: "Existing fixtures conflict with this competition." }, { status: 400 });
    }
    if (!f.season_id) {
      return json({ error: "Some fixtures have no season." }, { status: 400 });
    }
  }

  let seasonId: string | null = null;
  const seasonIds = [...new Set((fixtures as any[]).map((f: any) => f.season_id))];
  if (requestedSeasonId) {
    seasonId = requestedSeasonId;
    const inSeason = (fixtures as any[]).every((f: any) => f.season_id === seasonId);
    if (!inSeason) {
      return json({ error: "Existing fixtures do not belong to the selected season." }, { status: 400 });
    }
  } else if (seasonIds.length > 1) {
    return json({ error: "Fixtures exist in multiple seasons; choose a season." }, { status: 400 });
  } else {
    seasonId = seasonIds[0];
  }

  const entitlementError = await requireSeasonEntitlementForCompetitionSeason(competition.organization_id, seasonId);
  if (entitlementError) return entitlementError;

  const { data: seasonTeams, error: seasonTeamsError } = await sb
    .from("season_teams")
    .select("team:team_id(id, name)")
    .eq("season_id", seasonId)
    .order("team_id");

  if (seasonTeamsError) {
    logApiError("fixture_complete_season_teams_error", seasonTeamsError);
    return json({ error: "Failed to load season teams." }, { status: 500 });
  }

  if (!seasonTeams || seasonTeams.length < 2) {
    return json({ error: "Register at least 2 teams to this season before completing the schedule." }, { status: 400 });
  }

  const teamIds = seasonTeams.map((st: any) => st.team.id as number);
  const teamNameById = new Map<number, string>();
  for (const st of seasonTeams as any[]) {
    teamNameById.set(st.team.id, st.team.name);
  }

  const round1 = (fixtures as any[]).filter((f: any) => f.round === 1);
  if (round1.length === 0) {
    return json({ error: "Matchday 1 has not been set." }, { status: 400 });
  }

  const seenRound1 = new Set<number>();
  for (const f of round1) {
    if (seenRound1.has(f.home_team_id) || seenRound1.has(f.away_team_id)) {
      return json({ error: `Matchday 1 uses a team twice (fixture #${f.id}).` }, { status: 400 });
    }
    seenRound1.add(f.home_team_id);
    seenRound1.add(f.away_team_id);
  }

  const unscheduledRound1 = teamIds.filter((t: number) => !seenRound1.has(t));
  const isOdd = teamIds.length % 2 === 1;
  if (isOdd ? unscheduledRound1.length !== 1 : unscheduledRound1.length !== 0) {
    const list = unscheduledRound1.map((t: number) => teamNameById.get(t) || String(t)).join(", ");
    return json({ error: `Matchday 1 is incomplete. Missing: ${list || "unknown teams"}.` }, { status: 400 });
  }

  const seasonTeamSet = new Set(teamIds);
  for (const f of fixtures as any[]) {
    if (!seasonTeamSet.has(f.home_team_id) || !seasonTeamSet.has(f.away_team_id)) {
      return json({ error: "Teams added after fixtures exist; cannot complete automatically." }, { status: 400 });
    }
  }

  const existingPairsAll = new Set<string>();
  const pairToFixtures = new Map<string, number[]>();
  for (const f of fixtures as any[]) {
    const k = pairKey(f.home_team_id, f.away_team_id);
    existingPairsAll.add(k);
    if (!pairToFixtures.has(k)) pairToFixtures.set(k, []);
    pairToFixtures.get(k)!.push(f.id);
  }
  for (const [k, ids] of pairToFixtures.entries()) {
    if (ids.length > 1) {
      const [a, b] = k.split("-").map(Number);
      const an = teamNameById.get(a) || String(a);
      const bn = teamNameById.get(b) || String(b);
      return json({ error: `Fixture #${ids[0]} and #${ids[1]} both schedule ${an} vs ${bn}.` }, { status: 400 });
    }
  }

  const matchday1Pairs: [number, number][] = round1
    .sort((a: any, b: any) => a.id - b.id)
    .map((f: any) => [f.home_team_id, f.away_team_id]);

  let proposed: { round: number; byeId: number | null; pairs: [number, number][] }[];
  try {
    proposed = completeSingleRoundRobin(teamIds, matchday1Pairs);
  } catch (error: any) {
    return json({ error: error?.message || "Cannot complete the schedule." }, { status: 400 });
  }

  for (const f of fixtures as any[]) {
    const k = pairKey(f.home_team_id, f.away_team_id);
    const found = proposed.find((r) => r.pairs.some(([h, a]) => pairKey(h, a) === k));
    if (found && found.round !== f.round) {
      return json({ error: `Can't complete automatically: existing round ${f.round} fixture #${f.id} conflicts with the computed schedule.` }, { status: 400 });
    }
    if (!found) {
      return json({ error: `Can't complete automatically: existing fixture #${f.id} conflicts with the computed schedule.` }, { status: 400 });
    }
  }

  const teamsByRoundExisting = new Map<number, Set<number>>();
  for (const f of fixtures as any[]) {
    if (!teamsByRoundExisting.has(f.round)) teamsByRoundExisting.set(f.round, new Set());
    const s = teamsByRoundExisting.get(f.round)!;
    if (s.has(f.home_team_id) || s.has(f.away_team_id)) {
      return json({ error: `Round ${f.round} uses a team twice (fixture #${f.id}).` }, { status: 400 });
    }
    s.add(f.home_team_id);
    s.add(f.away_team_id);
  }

  const missingPairs: { round: number; homeId: number; awayId: number }[] = [];
  for (const r of proposed) {
    for (const [h, a] of r.pairs) {
      if (!existingPairsAll.has(pairKey(h, a))) {
        missingPairs.push({ round: r.round, homeId: h, awayId: a });
      }
    }
  }

  const roundsPayload = proposed.map((r) => ({
    round: r.round,
    byeId: r.byeId,
    byeTeamName: r.byeId !== null ? teamNameById.get(r.byeId) || null : null,
    matches: r.pairs.map(([h, a]) => ({
      homeTeamId: h,
      awayTeamId: a,
      homeTeamName: teamNameById.get(h) || String(h),
      awayTeamName: teamNameById.get(a) || String(a),
      round: r.round,
      existing: existingPairsAll.has(pairKey(h, a)),
    })),
  }));

  if (dryRun) {
    return json({
      success: true,
      dryRun: true,
      mode: "complete",
      seasonId,
      roundsCount: proposed.length,
      existingCount: fixtures.length,
      matchesCount: missingPairs.length,
      rounds: roundsPayload,
    });
  }

  if (missingPairs.length === 0) {
    return json({
      success: true,
      mode: "complete",
      seasonId,
      roundsCount: proposed.length,
      existingCount: fixtures.length,
      insertedCount: 0,
      matchesCount: 0,
      rounds: roundsPayload,
    });
  }

  const inserts: any[] = [];
  for (const p of missingPairs) {
    const d = startDate && intervalDays !== null ? addDays(startDate, (p.round - 1) * intervalDays) : null;
    inserts.push({
      competition_id: params.id,
      season_id: seasonId,
      round: p.round,
      home_team_id: p.homeId,
      away_team_id: p.awayId,
      status: "scheduled",
      date: d,
      time: null,
      venue: null,
    });
  }

  const { error: insertError } = await sb.from("fixtures").insert(inserts);
  if (insertError) {
    logApiError("fixture_complete_insert_error", insertError);
    return json({ error: "Failed to save fixtures." }, { status: 500 });
  }

  logSecurityEvent("fixtures_completed", {
    userId: auth?.userId,
    orgId: competition.organization_id,
    competitionId: params.id,
    seasonId,
    roundsCount: proposed.length,
    insertedCount: inserts.length,
  });
  void writeAuditRecord({
    organizationId: competition.organization_id,
    actorId: auth!.userId,
    actorRole: actorRole(auth),
    action: AUDIT_ACTIONS.FIXTURES_GENERATED,
    resourceType: "FIXTURES",
    resourceId: params.id,
    description: `Completed league schedule: added ${inserts.length} fixtures across ${proposed.length} rounds`,
    after: {
      mode: "complete",
      competitionId: params.id,
      seasonId,
      roundsCount: proposed.length,
      insertedCount: inserts.length,
      dryRun: false,
    },
    metadata: { mode: "complete", competitionId: params.id, seasonId, insertedCount: inserts.length },
    ip,
  }).catch(() => {});

  return json({
    success: true,
    mode: "complete",
    seasonId,
    roundsCount: proposed.length,
    existingCount: fixtures.length,
    insertedCount: inserts.length,
    matchesCount: inserts.length,
    rounds: roundsPayload,
  });
}
