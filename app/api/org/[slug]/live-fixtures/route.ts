import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { LiveFixture, LiveFixtureTeam } from "@/lib/types";
import { isLiveEligible, matchKickoff } from "@/lib/logic/live";
import { getAuthContext, json, logApiError, ownsTeam, requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

const SCHEDULED = "scheduled";

type FixtureDbRow = {
  id: number;
  round: number;
  home_team_id: number;
  away_team_id: number;
  home_score: number | null;
  away_score: number | null;
  status: string | null;
  date: string | null;
  time: string | null;
  venue: string | null;
  competition_id: string | null;
  live_started_at: string | null;
};

type TeamDbRow = { id: number; name: string; logo_url: string | null };
type CompetitionDbRow = { id: string; name: string | null };

const FIXTURE_COLUMNS =
  "id, round, home_team_id, away_team_id, home_score, away_score, status, date, time, venue, competition_id, live_started_at";

/**
 * Live match-logger feed for an organization.
 *
 * Scope is decided on the server, never by the client:
 *   - an org admin (or super admin) sees every live/soon fixture in the org;
 *   - a coach sees only fixtures where they own the home or away team.
 *
 * Live and in-progress fixtures are always included; scheduled fixtures are
 * admitted using the existing `isLiveEligible` window so the list agrees with
 * the rest of the app rather than inventing a second rule. The caller may pass
 * `tz` (the browser's `getTimezoneOffset()` in minutes) so kickoff resolution
 * matches the organizer's wall clock.
 */
export async function GET(request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;
    const authed = auth!;

    const sb = createServiceRoleClient();

    const { data: org } = await sb
      .from("organizations")
      .select("id")
      .eq("slug", params.slug)
      .single();

    if (!org) {
      return json({ error: "Organization not found." }, { status: 404 });
    }

    // Authorization: org admin (or super admin) OR a coach whose team belongs
    // to this organization. Mirrors the events POST ownership rule.
    const membership = authed.orgMembership;
    const isOrgAdmin =
      authed.isAdmin ||
      (membership != null &&
        membership.organization_id === org.id &&
        ["owner", "admin"].includes(membership.role));

    if (!isOrgAdmin && authed.teamAccount?.organization_id !== org.id) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const tzParam = Number(url.searchParams.get("tz"));
    const tzOffsetMinutes = Number.isFinite(tzParam) ? tzParam : 0;
    const now = new Date();
    const nowMs = now.getTime();

    const [{ data: teams }, { data: competitions }] = await Promise.all([
      sb.from("teams").select("id, name, logo_url").eq("organization_id", org.id),
      sb.from("competitions").select("id, name").eq("organization_id", org.id),
    ]);

    const teamById = new Map<number, LiveFixtureTeam>();
    for (const t of (teams || []) as TeamDbRow[]) {
      teamById.set(t.id, { id: t.id, name: t.name, logo: t.logo_url ?? null });
    }

    const competitionName = new Map<string, string | null>();
    for (const c of (competitions || []) as CompetitionDbRow[]) {
      competitionName.set(c.id, c.name);
    }

    const teamIds = Array.from(teamById.keys());
    if (teamIds.length === 0) {
      return json({ fixtures: [], liveCount: 0, serverTime: now.toISOString() });
    }

    // Fixtures are scoped to the org through its teams (the `fixtures` table's
    // organization column is not reliably populated), matching the org
    // fixtures route. Two queries: everything currently live, plus scheduled
    // fixtures inside a one-day window so "starting soon" can be resolved with
    // the existing eligibility rule without scanning the whole table.
    const conditions = teamIds
      .map((id) => `home_team_id.eq.${id},away_team_id.eq.${id}`)
      .join(",");
    const day = 24 * 60 * 60_000;
    const fromDate = new Date(nowMs - day).toISOString().split("T")[0];
    const toDate = new Date(nowMs + day).toISOString().split("T")[0];

    const [{ data: liveRows }, { data: soonRows }] = await Promise.all([
      sb
        .from("fixtures")
        .select(FIXTURE_COLUMNS)
        .or(conditions)
        .in("status", ["live", "in-progress"]),
      sb
        .from("fixtures")
        .select(FIXTURE_COLUMNS)
        .or(conditions)
        .eq("status", SCHEDULED)
        .gte("date", fromDate)
        .lte("date", toDate),
    ]);

    const seen = new Set<number>();
    const rows: FixtureDbRow[] = [];
    for (const row of [...((liveRows || []) as FixtureDbRow[]), ...((soonRows || []) as FixtureDbRow[])]) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }

    const fixturesOut: LiveFixture[] = [];

    for (const row of rows) {
      const home = teamById.get(row.home_team_id);
      const away = teamById.get(row.away_team_id);
      if (!home || !away) continue;

      const status = (row.status || SCHEDULED) as LiveFixture["status"];
      const isLive = status === "live" || status === "in-progress";

      const homeMine = ownsTeam(authed, row.home_team_id);
      const awayMine = ownsTeam(authed, row.away_team_id);

      if (!isOrgAdmin && !homeMine && !awayMine) continue;

      if (!isLive) {
        const eligible = isLiveEligible(
          {
            id: row.id,
            round: row.round,
            homeId: row.home_team_id,
            awayId: row.away_team_id,
            homeScore: row.home_score,
            awayScore: row.away_score,
            status: SCHEDULED,
            date: row.date || "",
            time: row.time || "",
            venue: row.venue || "",
            events: [],
          },
          nowMs,
          10,
          10,
          tzOffsetMinutes
        );
        if (!eligible) continue;
      }

      const kickoff =
        isLive && row.live_started_at
          ? new Date(row.live_started_at)
          : matchKickoff(
              { date: row.date ?? undefined, time: row.time ?? undefined },
              tzOffsetMinutes
            );

      fixturesOut.push({
        id: row.id,
        status,
        liveStartedAt: row.live_started_at,
        kickoff: kickoff ? kickoff.toISOString() : null,
        date: row.date,
        time: row.time,
        venue: row.venue,
        round: row.round,
        competitionId: row.competition_id,
        competitionName: row.competition_id
          ? competitionName.get(row.competition_id) ?? null
          : null,
        homeTeam: home,
        awayTeam: away,
        homeScore: row.home_score,
        awayScore: row.away_score,
        canLog: isOrgAdmin || homeMine || awayMine,
        isMine: homeMine || awayMine,
        isLive,
      });
    }

    fixturesOut.sort((a, b) => {
      if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
      const ax = a.kickoff ? new Date(a.kickoff).getTime() : 0;
      const bx = b.kickoff ? new Date(b.kickoff).getTime() : 0;
      return ax - bx;
    });

    return json({
      fixtures: fixturesOut,
      liveCount: fixturesOut.filter((f) => f.isLive).length,
      serverTime: now.toISOString(),
    });
  } catch (error) {
    logApiError("org_live_fixtures_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
