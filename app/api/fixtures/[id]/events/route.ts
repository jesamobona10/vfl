import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import {
  asInteger,
  asString,
  asOptionalString,
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  parseJsonObject,
  rateLimit,
  rateLimitResponse,
  requireAuth,
  requireOrgAdmin,
} from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function POST(
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
    const limited = rateLimit({ key: `events:create:${ip}:${authed.userId}`, limit: 120, windowMs: 60 * 60_000 });
    if (limited.limited) return rateLimitResponse(limited.resetAt);

    const fixtureId = asInteger(params.id, 1);
    if (!fixtureId) return json({ error: 'Invalid fixture id.' }, { status: 400 });

    const { data: fixture } = await supabase
      .from('fixtures')
      .select('home_team_id, away_team_id')
      .eq('id', fixtureId)
      .single();

    if (!fixture) return json({ error: 'Fixture not found.' }, { status: 404 });

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const playerId = asInteger(parsed.data!.player_id ?? parsed.data!.playerId, 1);
    const teamId = asInteger(parsed.data!.team_id ?? parsed.data!.teamId, 1);
    const eventType = asString(parsed.data!.type ?? parsed.data!.event_type, 30);
    const minute = asOptionalString(parsed.data!.minute, 3);

    if (!playerId) return json({ error: 'Player ID is required.' }, { status: 400 });
    if (!teamId) return json({ error: 'Team ID is required.' }, { status: 400 });
    if (!eventType) return json({ error: 'Event type is required.' }, { status: 400 });

    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from('match_events')
      .insert({
        match_id: fixtureId,
        player_id: playerId,
        team_id: teamId,
        event_type: eventType,
        minute: minute || null,
      })
      .select()
      .single();

    if (error) {
      logApiError('event_create_failed', error, { userId: authed.userId, fixtureId });
      return json({ error: 'Unable to save event.' }, { status: 400 });
    }

    return json({ event: data });
  } catch (error) {
    logApiError('event_create_error', error);
    return json({ error: 'Internal server error.' }, { status: 500 });
  }
}
