import { createServiceRoleClient } from '@/lib/supabase/service-role';
import {
  asInteger,
  asString,
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  parseJsonObject,
  rateLimit,
  rateLimitResponse,
  validatePassword,
  sanitizeText,
} from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limited = rateLimit({ key: `player_register:${ip}`, limit: 5, windowMs: 60 * 60_000 });
    if (limited.limited) {
      logSecurityEvent('player_register_rate_limited', { ip });
      return rateLimitResponse(limited.resetAt);
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const email = asString(parsed.data!.email, 254)?.toLowerCase();
    const password = parsed.data!.password;
    const displayName = sanitizeText(asString(parsed.data!.displayName, 80) || '');
    const playerId = asInteger(parsed.data!.playerId, 1); // optional link to existing players.id

    const passwordError = validatePassword(password);
    if (!email || passwordError) {
      logSecurityEvent('invalid_player_register_payload', { ip, email });
      return json({ error: passwordError || 'Valid email required.' }, { status: 400 });
    }

    const sb = createServiceRoleClient();

    const { data: authUser, error: createError } = await sb.auth.admin.createUser({
      email,
      password: password as string,
      email_confirm: true,
    });

    if (createError) {
      logApiError('player_register_create_user_failed', createError, { ip, email });
      return json({ error: 'Unable to create player account.' }, { status: 400 });
    }

    const insert: Record<string, unknown> = { id: authUser.user.id, display_name: displayName || email };
    if (playerId) insert.player_id = Number(playerId);

    const { error: insertError } = await sb.from('player_profiles').insert(insert);
    if (insertError) {
      await sb.auth.admin.deleteUser(authUser.user.id);
      logApiError('player_register_insert_profile_failed', insertError, { ip, userId: authUser.user.id });
      return json({ error: 'Unable to create player profile.' }, { status: 500 });
    }

    logSecurityEvent('player_register_succeeded', { ip, userId: authUser.user.id });
    return json({ success: true });
  } catch (error) {
    logApiError('player_register_error', error);
    return json({ error: 'Internal server error.' }, { status: 500 });
  }
}
