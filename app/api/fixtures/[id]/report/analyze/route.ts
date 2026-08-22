import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  actorRole,
  asInteger,
  asString,
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
import { providerFor, isAIConfigured } from "@/lib/ai/llm-provider";
import { extractMatchReport, PROMPT_VERSION } from "@/lib/ai/match-report.extractor";
import { loadFixtureContext, buildMatchContext } from "@/lib/ai/context-loader";
import { processExtraction } from "@/lib/ai/report-analysis";

export const dynamic = "force-dynamic";

const MAX_REPORT_LENGTH = 4000;
const MAX_ANALYSES_PER_MATCH = 20;

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    if (!isAIConfigured()) {
      return json(
        { error: "Match report analysis is not configured. Contact the administrator." },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    if (!auth) return json({ error: "Unauthorized" }, { status: 401 });
    const authed = auth;

    const ip = getClientIp(request);
    const limited = await rateLimit({
      key: `report:analyze:${ip}:${authed.userId}`,
      limit: 20,
      windowMs: 60 * 60_000,
    });
    if (limited.limited) return rateLimitResponse(limited.resetAt);

    const fixtureId = asInteger(params.id, 1);
    if (!fixtureId) return json({ error: "Invalid fixture id." }, { status: 400 });

    const loaded = await loadFixtureContext(supabase, fixtureId);
    if (!loaded) return json({ error: "Fixture not found." }, { status: 404 });

    const { homeOrgId, awayOrgId } = loaded;
    const orgId = homeOrgId || awayOrgId;

    if (homeOrgId !== awayOrgId) {
      return json({ error: "Fixture teams belong to different organizations." }, { status: 400 });
    }

    if (!orgId) {
      return json({ error: "Fixture teams are not organization-scoped." }, { status: 400 });
    }

    if (!authed.isAdmin) {
      const adminError = requireOrgAdmin(authed, orgId);
      if (adminError) return adminError;
    }

    // Cap analyses per match to limit AI cost abuse.
    const sb = createServiceRoleClient();
    const { count } = await sb
      .from("match_report_analyses")
      .select("id", { count: "exact", head: true })
      .eq("match_id", fixtureId);
    if ((count ?? 0) >= MAX_ANALYSES_PER_MATCH) {
      return json({ error: "Analysis limit reached for this match." }, { status: 429 });
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const report = asString(parsed.data!.report, MAX_REPORT_LENGTH);
    if (!report) {
      return json({ error: "A match report is required." }, { status: 400 });
    }

    const provider = providerFor();
    const context = buildMatchContext(loaded.context);
    const { payload } = await extractMatchReport(provider, report, context);

    if (!payload) {
      await sb.from("match_report_analyses").insert({
        organization_id: orgId,
        match_id: fixtureId,
        created_by: authed.userId,
        raw_text: report,
        status: "FAILED",
        events: [],
        warnings: [
          {
            code: "LLM_FAILURE",
            message:
              "The AI provider could not analyze the report. You can retry or enter events manually.",
          },
        ],
        model: provider.name,
        prompt_version: PROMPT_VERSION,
        ip_address: ip,
      });
      void audit(authed, orgId, fixtureId, null, "MATCH_REPORT_ANALYSIS_FAILED", ip, {});
      return json(
        {
          error:
            "Unable to analyze the report right now. You can retry or enter match events manually.",
        },
        { status: 502 }
      );
    }

    const outcome = processExtraction(payload, context, provider.name, PROMPT_VERSION);

    const { data: analysis, error: insertError } = await sb
      .from("match_report_analyses")
      .insert({
        organization_id: orgId,
        match_id: fixtureId,
        created_by: authed.userId,
        raw_text: report,
        status: outcome.requiresReview ? "REVIEW_REQUIRED" : "ANALYZED",
        events: outcome.events,
        warnings: outcome.warnings,
        score: outcome.score,
        model: provider.name,
        prompt_version: PROMPT_VERSION,
        ip_address: ip,
      })
      .select()
      .single();

    if (insertError) {
      logApiError("report_analyze_save_failed", insertError, { userId: authed.userId, fixtureId });
      return json({ error: "Unable to save analysis." }, { status: 400 });
    }

    void audit(authed, orgId, fixtureId, analysis.id, "MATCH_REPORT_ANALYZED", ip, {
      eventsDetected: outcome.events.length,
      requiresReview: outcome.requiresReview,
    });

    return json({
      analysis: {
        id: analysis.id,
        status: analysis.status,
        score: outcome.score,
        events: outcome.events,
        warnings: outcome.warnings,
        model: provider.name,
      },
    });
  } catch (error) {
    logApiError("report_analyze_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}

function audit(
  auth: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>,
  orgId: string,
  fixtureId: number,
  analysisId: number | null,
  action: string,
  ip: string,
  metadata: Record<string, unknown>
) {
  void writeAuditRecord({
    organizationId: orgId,
    actorId: auth.userId,
    actorRole: actorRole(auth),
    action: AUDIT_ACTIONS[action as keyof typeof AUDIT_ACTIONS] || action,
    resourceType: "MATCH",
    resourceId: fixtureId,
    description:
      action === "MATCH_EVENTS_CONFIRMED"
        ? `Confirmed AI-analyzed match events for fixture #${fixtureId}`
        : action === "MATCH_REPORT_ANALYZED"
          ? `Analyzed match report for fixture #${fixtureId}`
          : action === "MATCH_EVENT_CORRECTED"
            ? `Corrected proposed match events for fixture #${fixtureId}`
            : `Match report analysis for fixture #${fixtureId} failed`,
    metadata: { ...metadata, analysisId },
    ip,
  }).catch(() => {});
}
