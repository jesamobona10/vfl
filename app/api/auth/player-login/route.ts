import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { isValidPlayerUsername, playerEmailFromUsername } from '@/lib/player-credentials';
import {
  asString,
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  parseJsonObject,
  rateLimit,
  rateLimitResponse,
} from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const username = asString(parsed.data!.username, 80)?.toUpperCase();
    const password = asString(parsed.data!.password, 128);

    if (!username || !isValidPlayerUsername(username) || !password) {
      logSecurityEvent('invalid_player_login_payload', { ip });
      return json({ error: 'Invalid username or password.' }, { status: 400 });
    }

    const limited = rateLimit({ key: `login:player:${ip}:${username}`, limit: 5, windowMs: 15 * 60_000 });
    if (limited.limited) {
      logSecurityEvent('player_login_rate_limited', { ip, username });
      return rateLimitResponse(limited.resetAt);
    }

    const sb = createServiceRoleClient();
    const { data: profileRow, error: profileLookupError } = await sb
      .from('player_profiles')
      .select('id, player_id, display_name, username, must_change_password')
      .eq('username', username)
      .single();

    if (profileLookupError || !profileRow) {
      logSecurityEvent('player_login_unknown_account', { ip, username });
      return json({ error: 'Invalid username or password.' }, { status: 401 });
    }

    const email = playerEmailFromUsername(username);

    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      logSecurityEvent('player_login_failed', { ip, username });
      return json({ error: 'Invalid username or password.' }, { status: 401 });
    }

    if (authData.user.id !== profileRow.id) {
      logSecurityEvent('player_login_not_player', { ip, userId: authData.user.id });
      return json({ error: 'Unauthorized.' }, { status: 403 });
    }

    logSecurityEvent('player_login_succeeded', { ip, userId: authData.user.id });
    return json({
      user: {
        id: authData.user.id,
        role: 'player',
        playerId: profileRow.player_id,
        displayName: profileRow.display_name,
        username: profileRow.username,
        mustChangePassword: profileRow.must_change_password ?? false,
      },
    });
  } catch (error) {
    logApiError('player_login_error', error);
    return json({ error: 'Internal server error.' }, { status: 500 });
  }
}
