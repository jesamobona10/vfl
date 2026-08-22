import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  asString,
  actorRole,
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  parseJsonObject,
  rateLimit,
  rateLimitResponse,
  requireAuth,
  requireOrgAdmin,
  sanitizeText,
  writeAuditRecord,
} from "@/lib/security";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;

    const url = new URL(request.url);
    // Org scoping: non-admins are always limited to their own organization.
    // A client-supplied org_id must never widen access (service-role reads
    // bypass RLS, so this route would otherwise leak every org's teams).
    const requestedOrgId = url.searchParams.get("org_id");
    let orgId: string | null;
    if (auth!.isAdmin) {
      orgId = requestedOrgId || auth!.orgMembership?.organization_id || null;
    } else {
      orgId = auth!.orgMembership?.organization_id || null;
      if (!orgId) {
        return json({ error: "Organization ID is required." }, { status: 400 });
      }
      if (requestedOrgId && requestedOrgId !== orgId) {
        logSecurityEvent("teams_list_forbidden_org", {
          userId: auth!.userId,
          requestedOrgId,
          orgId,
        });
        return json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (!orgId) {
      return json({ error: "Organization ID is required." }, { status: 400 });
    }

    const sb = createServiceRoleClient();
    const { data, error } = await sb
      .from("teams")
      .select("*")
      .eq("organization_id", orgId)
      .order("id");

    if (error) {
      logApiError("teams_list_failed", error);
      return json({ error: "Unable to load teams." }, { status: 500 });
    }
    return json({ teams: data });
  } catch (error) {
    logApiError("teams_list_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);

    const ip = getClientIp(request);
    const limited = await rateLimit({
      key: `teams:create:${ip}:${auth?.userId || "anon"}`,
      limit: 60,
      windowMs: 60 * 60_000,
    });
    if (limited.limited) {
      logSecurityEvent("team_create_rate_limited", { ip, userId: auth?.userId });
      return rateLimitResponse(limited.resetAt);
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const name = asString(parsed.data!.name, 80);
    if (!name) return json({ error: "Team name is required." }, { status: 400 });

    const organization_id = asString(parsed.data!.organization_id, 64);
    if (!organization_id) return json({ error: "Organization ID is required." }, { status: 400 });

    const orgAdminError = requireOrgAdmin(auth, organization_id);
    if (orgAdminError) return orgAdminError;

    const { data, error } = await supabase
      .from("teams")
      .insert({ name: sanitizeText(name), organization_id })
      .select()
      .single();

    if (error) {
      logApiError("team_create_failed", error, { userId: auth!.userId });
      if (error.code === "23505") {
        return json({ error: "A team with this name already exists." }, { status: 409 });
      }
      return json({ error: "Unable to create team." }, { status: 400 });
    }
    logSecurityEvent("team_created", {
      ip,
      userId: auth!.userId,
      orgId: organization_id,
      teamId: data.id,
      teamName: name,
    });
    void writeAuditRecord({
      organizationId: organization_id,
      actorId: auth!.userId,
      actorRole: actorRole(auth),
      action: AUDIT_ACTIONS.TEAM_CREATED,
      resourceType: "TEAM",
      resourceId: data.id,
      description: `Created team ${name}`,
      after: { name: data.name, organization_id },
      ip,
    }).catch(() => {});
    return json({ team: data });
  } catch (error) {
    logApiError("team_create_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
