import { createClient } from '@/lib/supabase/server';
import {
  asInteger,
  asString,
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  rateLimit,
  rateLimitResponse,
  requireAuth,
} from '@/lib/security';

export const dynamic = 'force-dynamic';

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
    const playerId = asInteger(url.searchParams.get('player_id'), 1);
    const eventType = asString(url.searchParams.get('type'), 30);

    if (eventIdParam) {
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

    if (!matchId || !playerId || !eventType) {
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
