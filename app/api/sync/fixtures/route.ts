import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  asInteger,
  asOptionalString,
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
} from "@/lib/security";

const MAX_ROUNDS = 100;
const MAX_MATCHES = 1000;

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    if (!auth) return json({ error: "Unauthorized" }, { status: 401 });

    if (!auth.isAdmin && !auth.orgMembership) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    const ip = getClientIp(request);
    const limited = rateLimit({ key: `sync:fixtures:${ip}`, limit: 10, windowMs: 60 * 60_000 });
    if (limited.limited) {
      logSecurityEvent("sync_fixtures_rate_limited", { ip, userId: auth.userId });
      return rateLimitResponse(limited.resetAt);
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const fixtures = parsed.data!.fixtures;
    const teamIdMap =
      parsed.data!.teamIdMap && typeof parsed.data!.teamIdMap === "object"
        ? (parsed.data!.teamIdMap as Record<string, unknown>)
        : {};

    if (!fixtures || !Array.isArray(fixtures)) {
      return json({ error: "Fixtures array is required." }, { status: 400 });
    }

    if (fixtures.length > MAX_ROUNDS) {
      return json({ error: `Too many fixture rounds. Maximum is ${MAX_ROUNDS}.` }, { status: 400 });
    }

    const sb = createServiceRoleClient();

    const allMatches: any[] = [];
    for (const round of fixtures) {
      for (const match of round.matches ?? []) {
        if (allMatches.length >= MAX_MATCHES) break;
        const localHomeId = match.homeId ?? match.home_team_id;
        const localAwayId = match.awayId ?? match.away_team_id;
        const id = match.id != null ? Math.trunc(Number(match.id)) : undefined;
        const roundNo = asInteger(match.round ?? round.round, 1, 999);
        const homeTeamId = asInteger(teamIdMap?.[localHomeId] ?? localHomeId, 1);
        const awayTeamId = asInteger(teamIdMap?.[localAwayId] ?? localAwayId, 1);
        if (id == null || Number.isNaN(id) || !roundNo || !homeTeamId || !awayTeamId || homeTeamId === awayTeamId) continue;
        const status = asString(match.status, 30) || "scheduled";
        const venue = asOptionalString(match.venue, 120);
        allMatches.push({
          id,
          round: roundNo,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          home_score: match.homeScore ?? match.home_score,
          away_score: match.awayScore ?? match.away_score,
          status,
          date: match.date || null,
          time: match.time || null,
          venue: venue ? sanitizeText(venue) : null,
        });
      }
    }

    if (allMatches.length === 0) {
      return json({ error: "No matches found in fixtures data." }, { status: 400 });
    }

    const { error: insertError } = await sb.from("fixtures").upsert(allMatches, {
      onConflict: "id",
      ignoreDuplicates: false,
    });

    if (insertError) {
      logApiError("sync_fixtures_upsert_failed", insertError, { userId: auth.userId });
      return json({ error: "Unable to sync fixtures." }, { status: 500 });
    }

    const { data: synced } = await sb.from("fixtures").select("*").order("round").order("date").order("time").order("id");

    return json({ success: true, fixtures: synced });
  } catch (error) {
    logApiError("sync_fixtures_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
