import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { generatePlayerCredentialsForScope } from "@/lib/player-credentials";
import {
  asBoolean,
  asInteger,
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  parseJsonObject,
  rateLimit,
  rateLimitResponse,
  requireAdmin,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const ip = getClientIp(request);
    const limited = rateLimit({
      key: `gen_player_creds:admin:${ip}:${auth!.userId}`,
      limit: 10,
      windowMs: 60 * 60_000,
    });
    if (limited.limited) {
      logSecurityEvent("generate_player_credentials_rate_limited", {
        ip,
        userId: auth!.userId,
        scope: "admin",
      });
      return rateLimitResponse(limited.resetAt);
    }

    let forceRegenerate = false;
    let teamId: number | null = null;
    const parsed = await parseJsonObject(request);
    if (!parsed.error && parsed.data) {
      forceRegenerate = asBoolean(parsed.data.forceRegenerate) ?? false;
      teamId = asInteger(parsed.data.teamId, 1) ?? null;
    }

    const sb = createServiceRoleClient();
    const result = await generatePlayerCredentialsForScope({
      serviceClient: sb,
      teamId,
      forceRegenerate,
      generatedBy: auth!.userId,
      scope: "admin",
    });

    logSecurityEvent("generate_player_credentials_admin", {
      ip,
      userId: auth!.userId,
      teamId,
      created: result.created,
      regenerated: result.regenerated,
      skipped: result.skipped,
      failed: result.failed,
    });

    return json({
      success: true,
      summary: {
        created: result.created,
        regenerated: result.regenerated,
        skipped: result.skipped,
        failed: result.failed,
        total: result.credentials.length,
      },
      credentials: result.credentials.filter((c) => c.password),
    });
  } catch (error) {
    logApiError("generate_player_credentials_admin_error", error);
    return json({ error: "Unable to generate player credentials." }, { status: 500 });
  }
}
