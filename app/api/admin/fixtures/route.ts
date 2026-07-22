import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  rateLimit,
  rateLimitResponse,
  requireAdmin,
} from "@/lib/security";

export const dynamic = "force-dynamic";

interface MatchEvent {
  id: number;
  round: number;
  homeId: number;
  awayId: number;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  date: string;
  time: string;
  venue: string;
  events: Array<{
    type: string;
    playerId: number;
    minute: number | null;
    teamId: number;
  }>;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  manualEdited?: boolean;
  autoAdjusted?: boolean;
}

interface OrgGroup {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  rounds: {
    round: number;
    byeId: number | null;
    matches: MatchEvent[];
  }[];
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const ip = getClientIp(request);
    const limited = rateLimit({ key: `admin:fixtures:list:${ip}:${auth!.userId}`, limit: 60, windowMs: 60 * 60_000 });
    if (limited.limited) {
      logSecurityEvent("admin_fixtures_list_rate_limited", { ip, userId: auth!.userId });
      return rateLimitResponse(limited.resetAt);
    }

    const sb = createServiceRoleClient();

    const { data: fixtures, error: fixturesError } = await sb
      .from("fixtures")
      .select("*, home:home_team_id!inner(name, logo_url, organization_id), away:away_team_id!inner(name, logo_url, organization_id)")
      .order("round")
      .order("id");

    if (fixturesError) {
      logApiError("admin_fixtures_query_error", fixturesError);
      return json({ error: "Failed to load fixtures." }, { status: 500 });
    }

    const { data: orgs } = await sb
      .from("organizations")
      .select("id, name, slug, logo_url");

    const orgMap = new Map((orgs || []).map((o) => [o.id, o]));

    const orgGroups = new Map<string, MatchEvent[]>();

    for (const m of fixtures || []) {
      const orgId = m.home?.organization_id;
      if (!orgId) continue;

      const match: MatchEvent = {
        id: m.id,
        round: m.round,
        homeId: m.home_team_id,
        awayId: m.away_team_id,
        homeScore: m.home_score,
        awayScore: m.away_score,
        status: m.status || "scheduled",
        date: m.date || "",
        time: m.time || "",
        venue: m.venue || "",
        events: [],
        homeTeamName: m.home?.name || "?",
        awayTeamName: m.away?.name || "?",
        homeTeamLogo: m.home?.logo_url || undefined,
        awayTeamLogo: m.away?.logo_url || undefined,
      };

      if (!orgGroups.has(orgId)) orgGroups.set(orgId, []);
      orgGroups.get(orgId)!.push(match);
    }

    const result: OrgGroup[] = [];

    for (const [orgId, matches] of orgGroups) {
      const org = orgMap.get(orgId);
      const roundSet = new Set(matches.map((m) => m.round));
      const rounds = Array.from(roundSet).sort((a, b) => a - b).map((round) => {
        const roundMatches = matches
          .filter((m) => m.round === round)
          .sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            if (a.time !== b.time) return a.time.localeCompare(b.time);
            return a.id - b.id;
          });

        const teamIds = new Set<number>();
        roundMatches.forEach((m) => { teamIds.add(m.homeId); teamIds.add(m.awayId); });

        let byeId: number | null = null;
        if (teamIds.size % 2 !== 0) {
          const allTeamIds = new Set(matches.map((m) => m.homeId));
          matches.forEach((m) => allTeamIds.add(m.awayId));
          for (const tid of allTeamIds) {
            if (!teamIds.has(tid)) { byeId = tid; break; }
          }
        }

        return { round, byeId, matches: roundMatches };
      });

      result.push({
        id: orgId,
        name: org?.name || "Unknown",
        slug: org?.slug || "",
        logo_url: org?.logo_url || undefined,
        rounds,
      });
    }

    result.sort((a, b) => a.name.localeCompare(b.name));

    return json({ organizations: result });
  } catch (error) {
    logApiError("admin_fixtures_list_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
