import { createServiceRoleClient } from '@/lib/supabase/service-role';
import {
  asString,
  getClientIp,
  isValidEmail,
  json,
  logApiError,
  logSecurityEvent,
  parseJsonObject,
  rateLimit,
  rateLimitResponse,
} from '@/lib/security';
import { randomBytes, createHash } from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);

    const limited = rateLimit({
      key: `forgot-password:${ip}`,
      limit: 3,
      windowMs: 60 * 60_000,
    });
    if (limited.limited) {
      logSecurityEvent('forgot_password_rate_limited', { ip });
      return rateLimitResponse(limited.resetAt);
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const email = asString(parsed.data!.email, 254)?.toLowerCase();
    if (!email || !isValidEmail(email)) {
      return json({ error: 'Valid email is required.' }, { status: 400 });
    }

    const sb = createServiceRoleClient();

    const { data: { users }, error: listError } = await sb.auth.admin.listUsers();
    if (listError) {
      logApiError('forgot_password_list_failed', listError, { ip, email });
      return json({ error: 'Internal server error.' }, { status: 500 });
    }

    const targetUser = users?.find((u) => u.email?.toLowerCase() === email);
    if (!targetUser) {
      return json({ success: true });
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiry = Date.now() + 30 * 60 * 1000;

    const { error: updateError } = await sb.auth.admin.updateUserById(targetUser.id, {
      user_metadata: {
        ...targetUser.user_metadata,
        reset_token_hash: tokenHash,
        reset_token_expiry: expiry,
      },
    });

    if (updateError) {
      logApiError('forgot_password_update_failed', updateError, { ip, email });
      return json({ error: 'Internal server error.' }, { status: 500 });
    }

    logSecurityEvent('forgot_password_token_generated', { ip, userId: targetUser.id });

    return json({ success: true });
  } catch (error) {
    logApiError('forgot_password_error', error);
    return json({ error: 'Internal server error.' }, { status: 500 });
  }
}
