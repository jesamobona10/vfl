import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import {
  asInteger,
  asString,
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  parseJsonObject,
  rateLimit,
  rateLimitResponse,
  requireAdmin,
  sanitizeText,
  validatePassword,
} from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const ip = getClientIp(request);
    const limited = rateLimit({ key: `invite_player:${ip}:${auth!.userId}`, limit: 20, windowMs: 60 * 60_000 });
    if (limited.limited) {
      logSecurityEvent('invite_player_rate_limited', { ip, userId: auth!.userId });
      return rateLimitResponse(limited.resetAt);
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const email = asString(parsed.data!.email, 254)?.toLowerCase();
    const password = parsed.data!.password;
    const playerId = asInteger(parsed.data!.playerId, 1);
    const displayName = sanitizeText(asString(parsed.data!.displayName, 80) || '');

    const passwordError = validatePassword(password);
    if (!email || passwordError) {
      logSecurityEvent('invalid_invite_player_payload', { ip, userId: auth!.userId });
      return json({ error: passwordError || 'Valid email required.' }, { status: 400 });
    }

    const sb = createServiceRoleClient();

    const { data: authUser, error: createError } = await sb.auth.admin.createUser({
      email,
      password: password as string,
      email_confirm: true,
    });

    if (createError) {
      logApiError('invite_player_create_user_failed', createError, { ip, userId: auth!.userId });
      return json({ error: 'Unable to create player account.' }, { status: 400 });
    }

    const insert: Record<string, unknown> = { id: authUser.user.id, display_name: displayName || email };
    if (playerId) insert.player_id = playerId;

    const { error: insertError } = await sb.from('player_profiles').insert(insert);
    if (insertError) {
      await sb.auth.admin.deleteUser(authUser.user.id);
      logApiError('invite_player_insert_profile_failed', insertError, { ip, userId: auth!.userId });
      return json({ error: 'Unable to create player profile.' }, { status: 500 });
    }

    logSecurityEvent('invite_player_created', { ip, adminId: auth!.userId, playerId: authUser.user.id });
    return json({ success: true });
  } catch (error) {
    logApiError('invite_player_error', error);
    return json({ error: 'Internal server error.' }, { status: 500 });
  }
}
