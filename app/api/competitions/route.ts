import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
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
  requireOrgAdmin,
  requireOrgMember,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("org_id");
    if (!orgId) {
      return json({ error: "org_id query parameter is required." }, { status: 400 });
    }

    const memberError = requireOrgMember(auth, orgId);
    if (memberError) {
      logSecurityEvent("competitions_list_forbidden", {
        userId: auth?.userId,
        orgId,
        isAdmin: auth?.isAdmin,
      });
      return memberError;
    }
    const authed = auth!;

    const sb = createServiceRoleClient();
    const { data: competitions, error } = await sb
      .from("competitions")
      .select("*, seasons!competitions_current_season_id_fkey(name, short_name)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      logApiError("competitions_list_error", error, { userId: authed.userId, orgId });
      return json({ error: "Failed to fetch competitions." }, { status: 500 });
    }

    return json({ competitions: competitions || [] });
  } catch (error) {
    logApiError("competitions_list_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);

    const ip = getClientIp(request);
    const limited = rateLimit({
      key: `competitions:create:${ip}:${auth?.userId || "anon"}`,
      limit: 60,
      windowMs: 60 * 60_000,
    });
    if (limited.limited) {
      logSecurityEvent("competition_create_rate_limited", { ip, userId: auth?.userId });
      return rateLimitResponse(limited.resetAt);
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const organization_id = asString(parsed.data!.organization_id, 40);
    const name = asString(parsed.data!.name, 80);
    const type = asString(parsed.data!.type, 10);
    // Guide §21: a competition is identity-only; the first season is created alongside it.
    const seasonName = asString(parsed.data!.season_name ?? parsed.data!.seasonName, 80);
    const seasonShortName = asString(
      parsed.data!.season_short_name ?? parsed.data!.seasonShortName,
      40
    );
    const seasonStart = asOptionalString(parsed.data!.start_date, 10);
    const seasonEnd = asOptionalString(parsed.data!.end_date, 10);

    if (!organization_id || !name || !type) {
      return json({ error: "organization_id, name, and type are required." }, { status: 400 });
    }

    const adminError = requireOrgAdmin(auth, organization_id);
    if (adminError) {
      logSecurityEvent("competition_create_forbidden", {
        userId: auth?.userId,
        organizationId: organization_id,
        isAdmin: auth?.isAdmin,
      });
      return adminError;
    }
    const authed = auth!;

    if (!["league", "cup", "friendly"].includes(type)) {
      return json({ error: "type must be league, cup, or friendly." }, { status: 400 });
    }

    const sb = createServiceRoleClient();

    const { data: competition, error } = await sb
      .from("competitions")
      .insert({
        organization_id,
        name,
        type,
        created_by: authed.userId,
        settings: type === "league" ? { includeCup: true } : {},
      })
      .select()
      .single();

    if (error) {
      logApiError("competition_create_error", error, {
        userId: authed.userId,
        organizationId: organization_id,
      });
      return json({ error: "Failed to create competition." }, { status: 500 });
    }

    // Create the first season if a name was provided (guide §21)
    let season: Record<string, unknown> | null = null;
    if (seasonName) {
      const firstSeason = await sb
        .from("seasons")
        .insert({
          competition_id: competition.id,
          name: seasonName,
          short_name: seasonShortName || seasonName,
          start_date: seasonStart || null,
          end_date: seasonEnd || null,
          status: "active",
          is_current: true,
        })
        .select()
        .single();

      if (firstSeason.error) {
        logApiError("competition_first_season_error", firstSeason.error, {
          competitionId: competition.id,
        });
      } else {
        season = firstSeason.data;
        await sb
          .from("competitions")
          .update({ current_season_id: firstSeason.data.id })
          .eq("id", competition.id);
        competition.current_season_id = firstSeason.data.id;

        // Auto-register all of the organization's teams to the new season,
        // and their players to the corresponding season team rosters.
        const { data: orgTeams } = await sb
          .from("teams")
          .select("id, name, logo_url")
          .eq("organization_id", organization_id);

        if (orgTeams && orgTeams.length > 0) {
          const teamRows = orgTeams.map((t: any) => ({
            season_id: firstSeason.data.id,
            team_id: t.id,
            display_name: t.name,
            logo_url: t.logo_url || null,
            status: "active",
          }));

          const { data: inserted, error: teamError } = await sb
            .from("season_teams")
            .insert(teamRows)
            .select("id, team_id");

          if (teamError) {
            logApiError("competition_auto_register_teams_error", teamError, {
              competitionId: competition.id,
            });
          } else if (inserted && inserted.length > 0) {
            const teamIds = orgTeams.map((t: any) => t.id);
            const { data: players } = await sb
              .from("players")
              .select("id, team_id, position, jersey_number")
              .in("team_id", teamIds);

            if (players && players.length > 0) {
              const seasonTeamByTeamId = new Map(inserted.map((st: any) => [st.team_id, st.id]));
              const playerRows = players
                .filter((p: any) => seasonTeamByTeamId.has(p.team_id))
                .map((p: any) => ({
                  season_team_id: seasonTeamByTeamId.get(p.team_id)!,
                  player_id: p.id,
                  jersey_number: p.jersey_number ?? null,
                  position: p.position || null,
                  status: "active",
                }));

              if (playerRows.length > 0) {
                const { error: playerError } = await sb
                  .from("season_team_players")
                  .insert(playerRows);
                if (playerError) {
                  logApiError("competition_auto_register_players_error", playerError, {
                    competitionId: competition.id,
                  });
                }
              }
            }
          }
        }
      }
    }

    logSecurityEvent("competition_created", {
      ip,
      userId: authed.userId,
      orgId: organization_id,
      competitionId: competition.id,
      name,
      seasonId: (season as any)?.id || null,
    });

    return json({ competition, season });
  } catch (error) {
    logApiError("competition_create_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
