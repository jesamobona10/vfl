import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  actorRole,
  asBoolean,
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
  requireOrgAdmin,
  sanitizeText,
  writeAuditRecord,
} from "@/lib/security";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { resolveSeasonOrganization } from "@/lib/season-org";
import type { PlayerImportRow } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_IMPORT_ROWS = 1000;
const BATCH_SIZE = 200;
const VALID_POSITIONS = ["GK", "DEF", "MID", "ATT"];

function levenshtein(a: string, b: string): number {
  const m = a.length,
    n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function fuzzyTeamMatch(input: string, teamMap: Map<string, number>): number | null {
  const lower = input.toLowerCase().replace(/[\s]+/g, "");
  let best = { key: null as string | null, dist: Infinity };
  for (const [key, id] of teamMap) {
    const normalized = key.replace(/[\s]+/g, "");
    if (normalized === lower) return id;
    const dist = levenshtein(normalized, lower);
    if (dist < best.dist) best = { key, dist };
  }
  return best.dist <= 2 ? teamMap.get(best.key!)! : null;
}

export async function POST(request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const ip = getClientIp(request);
    const limited = await rateLimit({ key: `players:import:${ip}`, limit: 20, windowMs: 60 * 60_000 });
    if (limited.limited) {
      logSecurityEvent("player_import_rate_limited", { ip });
      return rateLimitResponse(limited.resetAt);
    }

    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    if (!auth) return json({ error: "Unauthorized" }, { status: 401 });

    const sb = createServiceRoleClient();

    const { data: org } = await sb
      .from("organizations")
      .select("id, name")
      .eq("slug", params.slug)
      .single();

    if (!org) {
      return json({ error: "Organization not found." }, { status: 404 });
    }

    const adminError = requireOrgAdmin(auth, org.id);
    if (adminError) return adminError;

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const rowsRaw = parsed.data!.players ?? parsed.data!.rows;
    if (!Array.isArray(rowsRaw)) {
      return json({ error: "players must be an array." }, { status: 400 });
    }
    if (rowsRaw.length === 0) {
      return json({ error: "No players to import." }, { status: 400 });
    }
    if (rowsRaw.length > MAX_IMPORT_ROWS) {
      return json({ error: `Too many players. Maximum is ${MAX_IMPORT_ROWS}.` }, { status: 400 });
    }

    const createMissingTeams = asBoolean(parsed.data!.create_missing_teams) ?? false;
    const seasonId = asOptionalString(parsed.data!.season_id, 40);

    // Fetch org teams for resolution.
    const { data: orgTeams } = await sb
      .from("teams")
      .select("id, name, logo_url")
      .eq("organization_id", org.id)
      .order("id");

    const teamMap = new Map<string, number>();
    (orgTeams || []).forEach((t: any) => {
      const key = t.name.trim().toLowerCase();
      if (key) teamMap.set(key, t.id);
    });

    // Fetch existing players to dedupe by (team, name) and (team, jersey).
    const teamIds = (orgTeams || []).map((t: any) => t.id);
    let existingPlayers: any[] = [];
    if (teamIds.length > 0) {
      const { data: players } = await sb
        .from("players")
        .select("team_id, name, jersey_number")
        .in("team_id", teamIds);
      existingPlayers = players || [];
    }
    const existingByName = new Set<string>();
    const existingByNumber = new Set<string>();
    existingPlayers.forEach((p: any) => {
      existingByName.add(`${p.team_id}:${p.name.trim().toLowerCase()}`);
      if (p.jersey_number) existingByNumber.add(`${p.team_id}:${p.jersey_number}`);
    });

    // Resolve teams and validate rows.
    const teamsToCreate = new Map<string, string>(); // normalized lower -> display name
    const rows: PlayerImportRow[] = [];
    const errors: string[] = [];
    const seenName = new Set(existingByName);
    const seenNumber = new Set(existingByNumber);

    for (const [i, raw] of rowsRaw.entries()) {
      const rowNum = i + 2; // CSV row numbers (header = 1)
      const name = asString(raw?.name, 80);
      const teamName = asString(raw?.team_name ?? raw?.teamName, 80);
      const positionRaw = asOptionalString(raw?.position, 10) || "MID";
      const position = VALID_POSITIONS.includes(positionRaw.toUpperCase())
        ? positionRaw.toUpperCase()
        : "MID";
      const jerseyNumber = asInteger(raw?.jersey_number ?? raw?.jerseyNumber, 1, 99);
      const isCaptain = asBoolean(raw?.is_captain) ?? false;

      if (!name) {
        errors.push(`Row ${rowNum}: name is empty`);
        continue;
      }
      if (!teamName) {
        errors.push(`Row ${rowNum} ("${name}"): team is empty`);
        continue;
      }

      // Resolve team (exact, then fuzzy).
      let teamId: number | null = teamMap.get(teamName.toLowerCase()) ?? null;
      if (!teamId) teamId = fuzzyTeamMatch(teamName, teamMap);

      if (!teamId && createMissingTeams) {
        const key = teamName.toLowerCase();
        if (!teamsToCreate.has(key)) teamsToCreate.set(key, teamName);
      } else if (!teamId) {
        errors.push(
          `Row ${rowNum} ("${name}"): team "${teamName}" not found in your organization. Enable "Create missing teams" to add it automatically.`
        );
        continue;
      }

      if (teamId) {
        const nameKey = `${teamId}:${name.toLowerCase()}`;
        if (seenName.has(nameKey)) {
          errors.push(
            `Row ${rowNum} ("${name}"): duplicate player name already exists in that team.`
          );
          continue;
        }
        if (jerseyNumber !== null) {
          const numKey = `${teamId}:${jerseyNumber}`;
          if (seenNumber.has(numKey)) {
            errors.push(
              `Row ${rowNum} ("${name}"): jersey #${jerseyNumber} already exists in that team.`
            );
            continue;
          }
        }
        seenName.add(nameKey);
        if (jerseyNumber !== null) seenNumber.add(`${teamId}:${jerseyNumber}`);
      }

      rows.push({
        team_name: teamName,
        team_exists: teamId !== null,
        name,
        position,
        jersey_number: jerseyNumber,
        is_captain: isCaptain,
      });
    }

    // Create missing teams.
    const createdTeams: any[] = [];
    for (const [key, displayName] of teamsToCreate) {
      const name = sanitizeText(displayName).slice(0, 80);
      const { data: created, error } = await sb
        .from("teams")
        .insert({ name, organization_id: org.id })
        .select("id, name")
        .single();
      if (error) {
        if (error.code === "23505") {
          // Race: already exists. Re-fetch.
          const { data: existing } = await sb
            .from("teams")
            .select("id, name")
            .eq("organization_id", org.id)
            .ilike("name", name)
            .maybeSingle();
          if (existing) {
            teamMap.set(existing.name.toLowerCase(), existing.id);
            createdTeams.push(existing);
            continue;
          }
        }
        logApiError("player_import_create_team_error", error, {
          organizationId: org.id,
          teamName: name,
        });
        errors.push(`Could not create team "${displayName}".`);
        continue;
      }
      teamMap.set(created.name.toLowerCase(), created.id);
      createdTeams.push(created);
    }

    // Re-resolve rows to final team ids now that teams exist.
    const finalRows: {
      team_id: number;
      name: string;
      position: string;
      jersey_number: number | null;
      is_captain: boolean;
    }[] = [];
    for (const row of rows) {
      const teamId =
        teamMap.get(row.team_name.toLowerCase()) ?? fuzzyTeamMatch(row.team_name, teamMap);
      if (!teamId) {
        errors.push(`Row for "${row.name}": team "${row.team_name}" could not be resolved.`);
        continue;
      }
      finalRows.push({
        team_id: teamId,
        name: sanitizeText(row.name).slice(0, 80),
        position: sanitizeText(row.position).slice(0, 10),
        jersey_number: row.jersey_number,
        is_captain: row.is_captain,
      });
    }

    if (finalRows.length === 0) {
      return json({
        imported: 0,
        createdTeams: createdTeams.length,
        errors,
        registeredToSeason: false,
      });
    }

    // Insert players in batches (service role bypasses RLS).
    const insertedPlayers: any[] = [];
    for (let start = 0; start < finalRows.length; start += BATCH_SIZE) {
      const chunk = finalRows.slice(start, start + BATCH_SIZE);
      const { data, error } = await sb
        .from("players")
        .insert(chunk)
        .select("id, team_id, name, position, jersey_number");
      if (error) {
        logApiError("player_import_insert_error", error, {
          organizationId: org.id,
          count: chunk.length,
        });
        errors.push("Database error while inserting a batch of players. Check the audit log.");
        break;
      }
      insertedPlayers.push(...(data || []));
    }

    // Optional season registration: ensure season_teams for the involved teams,
    // then register each inserted player into season_team_players.
    let registeredToSeason = false;
    if (seasonId && insertedPlayers.length > 0) {
      const { season, organizationId } = await resolveSeasonOrganization(sb, seasonId);
      if (season && organizationId === org.id) {
        const involvedTeamIds = [...new Set(insertedPlayers.map((p: any) => p.team_id))];

        // Ensure season_teams rows exist for involved teams.
        const { data: existingSeasonTeams } = await sb
          .from("season_teams")
          .select("id, team_id")
          .eq("season_id", seasonId)
          .in("team_id", involvedTeamIds);
        const existingByTeam = new Map(
          (existingSeasonTeams || []).map((st: any) => [st.team_id, st.id])
        );

        const { data: teamRows } = await sb
          .from("teams")
          .select("id, name")
          .in("id", involvedTeamIds);

        const seasonTeamInserts = (teamRows || [])
          .filter((t: any) => !existingByTeam.has(t.id))
          .map((t: any) => ({
            season_id: seasonId,
            team_id: t.id,
            display_name: t.name,
            status: "active",
          }));

        if (seasonTeamInserts.length > 0) {
          const { data: createdST } = await sb
            .from("season_teams")
            .insert(seasonTeamInserts)
            .select("id, team_id");
          (createdST || []).forEach((st: any) => existingByTeam.set(st.team_id, st.id));
        }

        // Register inserted players into the season roster. Use upsert so
        // already-registered players are skipped without erroring the batch.
        const registrationRows: any[] = [];
        for (const p of insertedPlayers) {
          const stId = existingByTeam.get(p.team_id);
          if (!stId) continue;
          registrationRows.push({
            season_team_id: stId,
            player_id: p.id,
            jersey_number: p.jersey_number ?? null,
            position: p.position || null,
            status: "active",
          });
        }

        for (let start = 0; start < registrationRows.length; start += BATCH_SIZE) {
          const chunk = registrationRows.slice(start, start + BATCH_SIZE);
          const { error: regError } = await sb
            .from("season_team_players")
            .upsert(chunk, { onConflict: "season_team_id,player_id", ignoreDuplicates: true });
          if (regError) {
            logApiError("player_import_season_register_error", regError, {
              organizationId: org.id,
              seasonId,
            });
            break;
          }
        }
        registeredToSeason = true;
      }
    }

    logSecurityEvent("players_imported", {
      ip,
      userId: auth.userId,
      orgId: org.id,
      imported: insertedPlayers.length,
      createdTeams: createdTeams.length,
      seasonId: seasonId || null,
      errorCount: errors.length,
    });

    void writeAuditRecord({
      organizationId: org.id,
      actorId: auth.userId,
      actorRole: actorRole(auth),
      action: AUDIT_ACTIONS.PLAYER_CREATED,
      resourceType: "PLAYER",
      description: `Bulk imported ${insertedPlayers.length} player(s)${createdTeams.length > 0 ? ` and created ${createdTeams.length} team(s)` : ""}${registeredToSeason ? " (registered to season)" : ""}`,
      after: {
        imported: insertedPlayers.length,
        createdTeams: createdTeams.length,
        errorCount: errors.length,
        seasonId: seasonId || null,
      },
      ip,
    }).catch(() => {});

    void sb
      .from("player_imports")
      .insert({
        organization_id: org.id,
        imported_by: auth.userId,
        total_rows: rowsRaw.length,
        imported_count: insertedPlayers.length,
        created_teams: createdTeams.length,
        error_count: errors.length,
        season_id: seasonId || null,
        errors: errors.slice(0, 100),
      })
      .then(
        () => {},
        () => {}
      );

    return json({
      imported: insertedPlayers.length,
      createdTeams: createdTeams.length,
      errors,
      registeredToSeason,
      players: insertedPlayers,
    });
  } catch (error) {
    logApiError("player_import_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
