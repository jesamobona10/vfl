import { createClient } from "@/lib/supabase/server";
import {
  asInteger,
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  rateLimit,
  rateLimitResponse,
  requireOrgAdmin,
  requireAuth,
  writeAuditRecord,
} from "@/lib/security";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";

export const dynamic = "force-dynamic";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const ip = getClientIp(request);
    const limited = await rateLimit({ key: `player_anonymize:${ip}`, limit: 5, windowMs: 60 * 60 * 1000 });
    if (limited.limited) return rateLimitResponse(limited.resetAt);

    const supabase = await createClient();
    const playerId = asInteger(params.id, 1);
    if (!playerId) return json({ error: "Invalid player id." }, { status: 400 });

    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;
    const authed = auth!;

    // Fetch player with team and organization info
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("id, name, team_id, photo_url, jersey_number, position, is_captain, teams(organization_id)")
      .eq("id", playerId)
      .maybeSingle();

    if (playerError || !player) {
      return json({ error: "Player not found." }, { status: 404 });
    }

    const orgId = (player.teams as unknown as { organization_id: string } | null)?.organization_id;
    if (!orgId) {
      return json({ error: "Player has no associated organization." }, { status: 400 });
    }

    // Require org admin access to this organization
    const orgAdminError = requireOrgAdmin(authed, orgId);
    if (orgAdminError) return orgAdminError;

    // Store original PII for audit
    const originalData = {
      name: player.name,
      photo_url: player.photo_url,
      jersey_number: player.jersey_number,
      position: player.position,
      is_captain: player.is_captain,
    };

    // Anonymize player record
    const { error: updateError } = await supabase
      .from("players")
      .update({
        name: null,
        photo_url: null,
        jersey_number: null,
        position: null,
        is_captain: false,
        anonymized_at: new Date().toISOString(),
        anonymized_by: authed.userId,
        original_name: player.name,
      })
      .eq("id", playerId);

    if (updateError) {
      logApiError("player_anonymize_failed", updateError, { userId: authed.userId, playerId });
      return json({ error: "Unable to anonymize player." }, { status: 400 });
    }

    // Anonymize player_profile if exists
    await supabase
      .from("player_profiles")
      .update({
        display_name: null,
        username: null,
        photo_url: null,
        bio: null,
        position: null,
        jersey_number: null,
        anonymized_at: new Date().toISOString(),
      })
      .eq("player_id", playerId);

    // Write audit record
    await writeAuditRecord({
      organizationId: orgId,
      actorId: authed.userId,
      actorRole: authed.isAdmin ? "super_admin" : "org_admin",
      action: AUDIT_ACTIONS.PLAYER_ANONYMIZED,
      resourceType: "PLAYER",
      resourceId: playerId,
      description: `Anonymized player ${originalData.name ?? playerId}`,
      before: originalData,
      after: {
        name: null,
        photo_url: null,
        jersey_number: null,
        position: null,
        is_captain: false,
        anonymized_at: new Date().toISOString(),
      },
      ip,
    }).catch((e) => console.error("Audit write failed:", e));

    return json({ success: true, message: "Player anonymized successfully." });
  } catch (error) {
    logApiError("player_anonymize_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}