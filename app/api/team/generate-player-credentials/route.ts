import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { generatePlayerCredentialsForScope } from "@/lib/player-credentials";
import {
  asBoolean,
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  parseJsonObject,
  rateLimit,
  rateLimitResponse,
  requireAuth,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;

    const teamId = auth!.teamAccount?.team_id;
    if (!auth!.isAdmin && !teamId) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    const ip = getClientIp(request);
    const limited = rateLimit({
      key: `gen_player_creds:team:${ip}:${auth!.userId}`,
      limit: 10,
      windowMs: 60 * 60_000,
    });
    if (limited.limited) {
      logSecurityEvent("generate_player_credentials_rate_limited", {
        ip,
        userId: auth!.userId,
        scope: "team",
      });
      return rateLimitResponse(limited.resetAt);
    }

    let forceRegenerate = false;
    const parsed = await parseJsonObject(request);
    if (!parsed.error && parsed.data) {
      forceRegenerate = asBoolean(parsed.data.forceRegenerate) ?? false;
    }

    const sb = createServiceRoleClient();
    const result = await generatePlayerCredentialsForScope({
      serviceClient: sb,
      teamId: teamId!,
      forceRegenerate,
      generatedBy: auth!.userId,
      scope: "team",
    });

    logSecurityEvent("generate_player_credentials_team", {
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
    logApiError("generate_player_credentials_team_error", error);
    return json({ error: "Unable to generate player credentials." }, { status: 500 });
  }
}
