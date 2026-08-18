import type { MatchContext, MatchContextPlayer } from "./llm-provider";

export interface FixtureContextData {
  fixture: {
    id: number;
    home_team_id: number;
    away_team_id: number;
    home_score: number | null;
    away_score: number | null;
    status: string;
  };
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  players: MatchContextPlayer[];
  existingEvents: MatchContext["existingEvents"];
  organizationId: string | null;
}

/**
 * Load the minimal, tenant-scoped context needed for AI extraction for a
 * single fixture: the two participating teams, their eligible players,
 * and already-recorded events. Both teams must belong to the same org.
 */
export function buildMatchContext(data: FixtureContextData): MatchContext {
  return {
    matchId: data.fixture.id,
    homeTeam: data.homeTeam,
    awayTeam: data.awayTeam,
    players: data.players,
    existingEvents: data.existingEvents,
  };
}

export interface LoadFixtureContextResult {
  context: FixtureContextData;
  homeOrgId: string | null;
  awayOrgId: string | null;
}

/**
 * Fetch a fixture plus both teams, their eligible players, and existing
 * events using the provided (already tenant-guarded) Supabase client.
 */
export async function loadFixtureContext(
  supabase: any,
  fixtureId: number
): Promise<LoadFixtureContextResult | null> {
  const { data: fixture, error: fixtureError } = await supabase
    .from("fixtures")
    .select("id, home_team_id, away_team_id, home_score, away_score, status")
    .eq("id", fixtureId)
    .single();

  if (fixtureError || !fixture) return null;

  const { data: homeTeam } = await supabase
    .from("teams")
    .select("id, name, organization_id")
    .eq("id", fixture.home_team_id)
    .single();

  const { data: awayTeam } = await supabase
    .from("teams")
    .select("id, name, organization_id")
    .eq("id", fixture.away_team_id)
    .single();

  if (!homeTeam || !awayTeam) return null;

  const { data: players } = await supabase
    .from("players")
    .select("id, name, team_id, jersey_number")
    .in("team_id", [homeTeam.id, awayTeam.id]);

  const { data: existingEvents } = await supabase
    .from("match_events")
    .select("event_type, minute, player_id, team_id")
    .eq("match_id", fixtureId);

  const eligiblePlayers: MatchContextPlayer[] = (players || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    teamId: p.team_id,
    jerseyNumber: p.jersey_number ?? null,
  }));

  const existingEventsNormalized = (existingEvents || []).map((e: any) => ({
    type: e.event_type,
    minute: e.minute ?? null,
    playerId: e.player_id ?? null,
    teamId: e.team_id ?? null,
  }));

  return {
    context: {
      fixture: {
        id: fixture.id,
        home_team_id: fixture.home_team_id,
        away_team_id: fixture.away_team_id,
        home_score: fixture.home_score ?? null,
        away_score: fixture.away_score ?? null,
        status: fixture.status,
      },
      homeTeam: { id: homeTeam.id, name: homeTeam.name },
      awayTeam: { id: awayTeam.id, name: awayTeam.name },
      players: eligiblePlayers,
      existingEvents: existingEventsNormalized,
      organizationId: homeTeam.organization_id || null,
    },
    homeOrgId: homeTeam.organization_id || null,
    awayOrgId: awayTeam.organization_id || null,
  };
}
