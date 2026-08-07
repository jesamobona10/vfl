import { createClient } from '@/lib/supabase/server';
import {
  asInteger,
  asString,
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  ownsTeam,
  rateLimit,
  rateLimitResponse,
  requireAuth,
  requireOrgAdmin,
} from '@/lib/security';

export const dynamic = 'force-dynamic';

async function checkEventOwnership(
  supabase: ReturnType<typeof createClient>,
  authed: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>,
  matchId: number
): Promise<Response | null> {
  const { data: fixture } = await supabase
    .from('fixtures')
    .select('home_team_id, away_team_id')
    .eq('id', matchId)
    .single();

  if (!fixture) return json({ error: 'Fixture not found.' }, { status: 404 });

  const { data: homeTeam } = await supabase
    .from('teams')
    .select('organization_id')
    .eq('id', fixture.home_team_id)
    .single();

  const { data: awayTeam } = await supabase
    .from('teams')
    .select('organization_id')
    .eq('id', fixture.away_team_id)
    .single();

  if (!homeTeam || !awayTeam) return json({ error: 'Team not found.' }, { status: 404 });

  const orgId = homeTeam.organization_id;
  const isOrgAdmin = requireOrgAdmin(authed, orgId) === null;
  const isTeamOwner = ownsTeam(authed, fixture.home_team_id) || ownsTeam(authed, fixture.away_team_id);

  if (!isOrgAdmin && !isTeamOwner) {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  return null;
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;
    const authed = auth!;

    const ip = getClientIp(request);
    const limited = rateLimit({ key: `events:delete:${ip}:${authed.userId}`, limit: 60, windowMs: 60 * 60_000 });
    if (limited.limited) return rateLimitResponse(limited.resetAt);

    const url = new URL(request.url);
    const eventIdParam = asInteger(params.id, 1);
    const matchId = asInteger(url.searchParams.get('match_id'), 1);

    if (eventIdParam) {
      const { data: event } = await supabase
        .from('match_events')
        .select('match_id')
        .eq('id', eventIdParam)
        .single();

      if (!event) return json({ error: 'Event not found.' }, { status: 404 });

      const ownershipError = await checkEventOwnership(supabase, authed, event.match_id);
      if (ownershipError) return ownershipError;

      const { error } = await supabase
        .from('match_events')
        .delete()
        .eq('id', eventIdParam);

      if (error) {
        logApiError('event_delete_failed', error, { userId: authed.userId, eventId: eventIdParam });
        return json({ error: 'Unable to delete event.' }, { status: 400 });
      }
      return json({ success: true });
    }

    if (!matchId) {
      return json({ error: 'Provide event id, or match_id + player_id + type.' }, { status: 400 });
    }

    const ownershipError = await checkEventOwnership(supabase, authed, matchId);
    if (ownershipError) return ownershipError;

    const playerId = asInteger(url.searchParams.get('player_id'), 1);
    const eventType = asString(url.searchParams.get('type'), 30);

    if (!playerId || !eventType) {
      return json({ error: 'Provide event id, or match_id + player_id + type.' }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from('match_events')
      .select('id')
      .eq('match_id', matchId)
      .eq('player_id', playerId)
      .eq('event_type', eventType)
      .limit(1);

    if (!existing || existing.length === 0) {
      return json({ error: 'Event not found.' }, { status: 404 });
    }

    const { error } = await supabase
      .from('match_events')
      .delete()
      .eq('id', existing[0].id);

    if (error) {
      logApiError('event_delete_failed', error, { userId: authed.userId });
      return json({ error: 'Unable to delete event.' }, { status: 400 });
    }

    return json({ success: true });
  } catch (error) {
    logApiError('event_delete_error', error);
    return json({ error: 'Internal server error.' }, { status: 500 });
  }
}
