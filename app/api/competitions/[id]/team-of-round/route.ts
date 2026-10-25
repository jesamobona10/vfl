import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  asInteger,
  getAuthContext,
  json,
  logApiError,
  requireAuth,
  requireOrgReadAccess,
} from "@/lib/security";
import {
  buildTeamOfRound,
  summarizeRounds,
  type RoundEventInput,
  type RoundFixtureInput,
  type RoundLineupInput,
  type RoundPlayerInput,
  type RoundTeamInput,
} from "@/lib/logic/team-of-round";

export const dynamic = "force-dynamic";

function starterIdsFromLineup(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((slot) => {
      if (!slot || typeof slot !== "object") return null;
      const playerId = (slot as { playerId?: unknown }).playerId;
      return typeof playerId === "number" && Number.isInteger(playerId) ? playerId : null;
    })
    .filter((playerId): playerId is number => playerId != null);
}

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;

    const sb = createServiceRoleClient();
    const { data: competition } = await sb
      .from("competitions")
      .select("organization_id")
      .eq("id", params.id)
      .maybeSingle();

    if (!competition) return json({ error: "Competition not found." }, { status: 404 });

    const memberError = await requireOrgReadAccess(auth, competition.organization_id, sb);
    if (memberError) return memberError;

    const url = new URL(request.url);
    const seasonParam = url.searchParams.get("season_id") ?? url.searchParams.get("seasonId");
    let seasonId = seasonParam;

    if (seasonId) {
      const { data: season } = await sb
        .from("seasons")
        .select("id")
        .eq("id", seasonId)
        .eq("competition_id", params.id)
        .maybeSingle();
      if (!season) return json({ error: "Season not found." }, { status: 404 });
    } else {
      const { data: season } = await sb
        .from("seasons")
        .select("id")
        .eq("competition_id", params.id)
        .order("is_current", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      seasonId = season?.id ?? null;
    }

    if (!seasonId) {
      return json({
        competitionId: params.id,
        seasonId: null,
        round: null,
        completed: false,
        rounds: [],
        team: [],
        playerOfRound: null,
        note: "No season selected.",
      });
    }

    const { data: fixtureRows, error: fixtureError } = await sb
      .from("fixtures")
      .select("id, round, home_team_id, away_team_id, home_score, away_score, status")
      .eq("competition_id", params.id)
      .eq("season_id", seasonId)
      .order("round", { ascending: true })
      .order("id", { ascending: true });

    if (fixtureError) {
      logApiError("team_of_round_fixtures_error", fixtureError);
      return json({ error: "Failed to load fixtures." }, { status: 500 });
    }

    const fixtures = fixtureRows || [];
    const rounds = summarizeRounds(
      fixtures.map((fixture) => ({ round: fixture.round, status: fixture.status }))
    );

    if (!rounds.length) {
      return json({
        competitionId: params.id,
        seasonId,
        round: null,
        completed: false,
        rounds: [],
        team: [],
        playerOfRound: null,
        note: "No fixtures have been generated for this season.",
      });
    }

    const requestedRound = asInteger(url.searchParams.get("round"), 0);
    let selectedRound: number | null = requestedRound;
    if (selectedRound == null) {
      const completedRounds = rounds.filter((round) => round.complete);
      selectedRound = completedRounds.length
        ? completedRounds[completedRounds.length - 1].round
        : rounds[rounds.length - 1].round;
    }

    const selectedSummary = rounds.find((round) => round.round === selectedRound);
    if (!selectedSummary) {
      return json({ error: "Round not found." }, { status: 404 });
    }

    if (!selectedSummary.complete) {
      return json({
        competitionId: params.id,
        seasonId,
        round: selectedRound,
        completed: false,
        rounds,
        team: [],
        playerOfRound: null,
        note:
          selectedSummary.completedMatches === 0
            ? `Round ${selectedRound} has no completed matches yet.`
            : `Round ${selectedRound} is still in progress. The Team of the Round appears when every match is completed.`,
      });
    }

    const roundFixtures = fixtures.filter((fixture) => (fixture.round ?? 0) === selectedRound);
    const roundFixtureIds = roundFixtures.map((fixture) => fixture.id);
    const teamIds = [
      ...new Set(roundFixtures.flatMap((fixture) => [fixture.home_team_id, fixture.away_team_id])),
    ];

    const [
      { data: eventRows, error: eventError },
      { data: lineupRows, error: lineupError },
      { data: teamRows, error: teamError },
      { data: playerRows, error: playerError },
      { data: seasonTeamRows },
    ] = await Promise.all([
      sb
        .from("match_events")
        .select("match_id, player_id, team_id, event_type")
        .in("match_id", roundFixtureIds),
      sb
        .from("fixture_lineups")
        .select("fixture_id, team_id, starting_xi, status")
        .in("fixture_id", roundFixtureIds),
      sb.from("teams").select("id, name, logo_url").in("id", teamIds),
      sb.from("players").select("id, name, team_id, position, photo_url").in("team_id", teamIds),
      sb
        .from("season_teams")
        .select("id, team_id")
        .eq("season_id", seasonId)
        .in("team_id", teamIds),
    ]);

    if (eventError || lineupError || teamError || playerError) {
      logApiError(
        "team_of_round_data_error",
        eventError || lineupError || teamError || playerError
      );
      return json({ error: "Failed to load round data." }, { status: 500 });
    }

    const seasonTeamIds = (seasonTeamRows || []).map((row) => row.id);
    const { data: seasonPlayerRows } = seasonTeamIds.length
      ? await sb
          .from("season_team_players")
          .select("player_id, position")
          .in("season_team_id", seasonTeamIds)
      : { data: [] as Array<{ player_id: number; position: string | null }> };

    const positionByPlayer = new Map<number, string>();
    for (const row of seasonPlayerRows || []) {
      if (row.position) positionByPlayer.set(row.player_id, row.position);
    }

    // If a fixture/team has more than one lineup row, prefer the approved one.
    const lineupByKey = new Map<
      string,
      { fixtureId: number; teamId: number; starterIds: number[]; approved: boolean }
    >();
    for (const row of lineupRows || []) {
      const key = `${row.fixture_id}:${row.team_id}`;
      const entry = {
        fixtureId: row.fixture_id,
        teamId: row.team_id,
        starterIds: starterIdsFromLineup(row.starting_xi),
        approved: row.status === "approved",
      };
      const existing = lineupByKey.get(key);
      if (!existing || (!existing.approved && entry.approved)) lineupByKey.set(key, entry);
    }

    const fixturesInput: RoundFixtureInput[] = roundFixtures.map((fixture) => ({
      id: fixture.id,
      homeTeamId: fixture.home_team_id,
      awayTeamId: fixture.away_team_id,
      homeScore: fixture.home_score,
      awayScore: fixture.away_score,
      status: fixture.status,
    }));

    const eventsInput: RoundEventInput[] = (eventRows || []).map((event) => ({
      fixtureId: event.match_id,
      playerId: event.player_id,
      teamId: event.team_id,
      type: event.event_type,
    }));

    const lineupsInput: RoundLineupInput[] = [...lineupByKey.values()].map((lineup) => ({
      fixtureId: lineup.fixtureId,
      teamId: lineup.teamId,
      starterIds: lineup.starterIds,
    }));

    const playersInput: RoundPlayerInput[] = (playerRows || []).map((player) => ({
      id: player.id,
      name: player.name,
      teamId: player.team_id,
      position: positionByPlayer.get(player.id) ?? player.position ?? null,
      photoUrl: player.photo_url ?? null,
    }));

    const teamsInput: RoundTeamInput[] = (teamRows || []).map((team) => ({
      id: team.id,
      name: team.name,
      logo: team.logo_url ?? null,
    }));

    const result = buildTeamOfRound({
      fixtures: fixturesInput,
      events: eventsInput,
      lineups: lineupsInput,
      players: playersInput,
      teams: teamsInput,
    });

    return json({
      competitionId: params.id,
      seasonId,
      round: selectedRound,
      completed: true,
      rounds,
      team: result.team,
      playerOfRound: result.playerOfRound,
      note:
        result.team.length === 0
          ? "No player appearances or match events have been recorded for this round."
          : result.team.length < 11
            ? "Some positions could not be filled because too few players appeared in this round."
            : null,
    });
  } catch (error) {
    logApiError("team_of_round_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
