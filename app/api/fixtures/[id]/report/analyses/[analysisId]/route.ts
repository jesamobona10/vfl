import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  actorRole,
  asInteger,
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  parseJsonObject,
  rateLimit,
  rateLimitResponse,
  requireOrgAdmin,
  writeAuditRecord,
} from "@/lib/security";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { loadFixtureContext, buildMatchContext } from "@/lib/ai/context-loader";
import { validateEvents } from "@/lib/ai/event-validation";
import type { ResolvedEvent } from "@/lib/ai/event-validation";

export const dynamic = "force-dynamic";

function guardFixture(
  fixtureId: number | null,
  analysisId: number | null,
  request: Request,
  auth: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>,
  supabase: any
): Promise<{ error: string; status: number } | null> {
  if (!fixtureId || !analysisId) {
    return Promise.resolve({ error: "Invalid fixture or analysis id.", status: 400 });
  }
  return loadFixtureContext(supabase, fixtureId)
    .then((loaded) => {
      if (!loaded) return { error: "Fixture not found.", status: 404 };
      const { homeOrgId, awayOrgId } = loaded;
      if (homeOrgId !== awayOrgId) {
        return { error: "Fixture teams belong to different organizations.", status: 400 };
      }
      if (!auth.isAdmin) {
        const adminError = requireOrgAdmin(auth, homeOrgId || awayOrgId || "");
        if (adminError) return { error: "Forbidden", status: 403 };
      }
      return null;
    })
    .catch(() => ({ error: "Internal server error.", status: 500 }));
}

export async function GET(
  request: Request,
  { params }: { params: { id: string; analysisId: string } }
) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    if (!auth) return json({ error: "Unauthorized" }, { status: 401 });

    const fixtureId = asInteger(params.id, 1);
    const analysisId = asInteger(params.analysisId, 1);
    const unauthed = await guardFixture(fixtureId, analysisId, request, auth, supabase);
    if (unauthed) return json({ error: unauthed.error }, { status: unauthed.status });

    const sb = createServiceRoleClient();
    const { data: analysis, error } = await sb
      .from("match_report_analyses")
      .select("*")
      .eq("id", analysisId)
      .eq("match_id", fixtureId)
      .maybeSingle();

    if (error || !analysis) {
      return json({ error: "Analysis not found." }, { status: 404 });
    }

    return json({ analysis });
  } catch (error) {
    logApiError("report_analysis_get_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; analysisId: string } }
) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    if (!auth) return json({ error: "Unauthorized" }, { status: 401 });
    const authed = auth;

    const ip = getClientIp(request);
    const limited = rateLimit({
      key: `report:patch:${ip}:${authed.userId}`,
      limit: 60,
      windowMs: 60 * 60_000,
    });
    if (limited.limited) return rateLimitResponse(limited.resetAt);

    const fixtureId = asInteger(params.id, 1);
    const analysisId = asInteger(params.analysisId, 1);
    const unauthed = await guardFixture(fixtureId, analysisId, request, authed, supabase);
    if (unauthed) return json({ error: unauthed.error }, { status: unauthed.status });

    const loaded = await loadFixtureContext(supabase, fixtureId!);
    if (!loaded) return json({ error: "Fixture not found." }, { status: 404 });
    const orgId = loaded.homeOrgId || loaded.awayOrgId || "";

    const sb = createServiceRoleClient();
    const { data: analysis, error: fetchError } = await sb
      .from("match_report_analyses")
      .select("*")
      .eq("id", analysisId)
      .eq("match_id", fixtureId)
      .maybeSingle();

    if (fetchError || !analysis) {
      return json({ error: "Analysis not found." }, { status: 404 });
    }
    if (analysis.status === "CONFIRMED") {
      return json({ error: "This analysis has already been confirmed." }, { status: 400 });
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const rawEvents = parsed.data!.events;
    if (!Array.isArray(rawEvents)) {
      return json({ error: "events must be an array." }, { status: 400 });
    }

    const context = buildMatchContext(loaded.context);
    const result = validateEvents(rawEvents as ResolvedEvent[], context, {
      homeScore: null,
      awayScore: null,
    });

    const { data: updated, error: updateError } = await sb
      .from("match_report_analyses")
      .update({
        events: result.events,
        warnings: result.warnings,
        score: result.score,
        status: result.warnings.length > 0 ? "REVIEW_REQUIRED" : "ANALYZED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", analysisId)
      .select()
      .single();

    if (updateError) {
      logApiError("report_analysis_update_failed", updateError, {
        userId: authed.userId,
        fixtureId,
      });
      return json({ error: "Unable to save corrections." }, { status: 400 });
    }

    void writeAuditRecord({
      organizationId: orgId,
      actorId: authed.userId,
      actorRole: actorRole(authed),
      action: AUDIT_ACTIONS.MATCH_EVENT_CORRECTED,
      resourceType: "MATCH",
      resourceId: fixtureId!,
      description: `FA corrected proposed events for analysis #${analysisId} on fixture #${fixtureId}`,
      metadata: { analysisId, eventsDetected: result.events.length },
      ip,
    }).catch(() => {});

    return json({
      analysis: {
        id: updated.id,
        status: updated.status,
        score: result.score,
        events: result.events,
        warnings: result.warnings,
      },
    });
  } catch (error) {
    logApiError("report_analysis_patch_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
