import { createServiceRoleClient } from '@/lib/supabase/service-role';
import {
  asString,
  getClientIp,
  validatePassword,
  json,
  logApiError,
  logSecurityEvent,
  parseJsonObject,
  rateLimit,
  rateLimitResponse,
} from '@/lib/security';
import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);

    const limited = rateLimit({
      key: `reset-password:${ip}`,
      limit: 5,
      windowMs: 60 * 60_000,
    });
    if (limited.limited) {
      logSecurityEvent('reset_password_rate_limited', { ip });
      return rateLimitResponse(limited.resetAt);
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const email = asString(parsed.data!.email, 254)?.toLowerCase();
    const token = asString(parsed.data!.token);
    const password = asString(parsed.data!.password, 128);

    if (!email || !token || !password) {
      return json({ error: 'Email, token, and password are required.' }, { status: 400 });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return json({ error: passwordError }, { status: 400 });
    }

    const sb = createServiceRoleClient();

    const { data: { users }, error: listError } = await sb.auth.admin.listUsers();
    if (listError) {
      logApiError('reset_password_list_failed', listError, { ip, email });
      return json({ error: 'Internal server error.' }, { status: 500 });
    }

    const targetUser = users?.find((u) => u.email?.toLowerCase() === email);
    if (!targetUser) {
      return json({ error: 'Invalid token or email.' }, { status: 400 });
    }

    const userMetadata = targetUser.user_metadata || {};
    const storedHash = userMetadata.reset_token_hash;
    const storedExpiry = userMetadata.reset_token_expiry;

    if (!storedHash || !storedExpiry) {
      return json({ error: 'Invalid token or email.' }, { status: 400 });
    }

    if (Date.now() > storedExpiry) {
      await sb.auth.admin.updateUserById(targetUser.id, {
        user_metadata: {
          ...targetUser.user_metadata,
          reset_token_hash: null,
          reset_token_expiry: null,
        },
      });
      logSecurityEvent('reset_password_token_expired', { ip, userId: targetUser.id });
      return json({ error: 'Token has expired.' }, { status: 400 });
    }

    const providedHash = createHash('sha256').update(token).digest('hex');

    if (providedHash !== storedHash) {
      logSecurityEvent('reset_password_invalid_token', { ip, userId: targetUser.id });
      return json({ error: 'Invalid token or email.' }, { status: 400 });
    }

    const { error: updateError } = await sb.auth.admin.updateUserById(targetUser.id, {
      password,
    });

    if (updateError) {
      logApiError('reset_password_update_failed', updateError, { ip, userId: targetUser.id });
      return json({ error: 'Internal server error.' }, { status: 500 });
    }

    await sb.auth.admin.updateUserById(targetUser.id, {
      user_metadata: {
        ...targetUser.user_metadata,
        reset_token_hash: null,
        reset_token_expiry: null,
      },
    });

    logSecurityEvent('password_reset_success', { ip, userId: targetUser.id });

    return json({ success: true });
  } catch (error) {
    logApiError('reset_password_error', error);
    return json({ error: 'Internal server error.' }, { status: 500 });
  }
}
