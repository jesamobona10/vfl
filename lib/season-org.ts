import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Season → organization resolution helpers.
 *
 * Previously the season API routes resolved a season's owning organization
 * with a PostgREST embed: `.select("id, competition:competitions(organization_id)")`.
 * PostgREST only honors embeds when a real foreign-key constraint links the
 * two tables. If the `seasons` table predates the FK (or the constraint is
 * missing), that embed errors and the handler returned 404 for seasons that
 * actually exist.
 *
 * These helpers resolve the organization with two explicit queries instead,
 * which works regardless of whether the FK constraint exists in the database.
 */

/**
 * Resolve a season's owning organization.
 * @param sb - Supabase client instance
 * @param seasonId - UUID of the season
 * @returns The season row (with `competition_id`) and the resolved `organizationId`, or nulls if not found.
 */
export async function resolveSeasonOrganization(sb: SupabaseClient, seasonId: string) {
  const { data: season } = await sb
    .from("seasons")
    .select("id, competition_id")
    .eq("id", seasonId)
    .maybeSingle();

  if (!season?.competition_id) return { season: null, organizationId: null };

  const { data: competition } = await sb
    .from("competitions")
    .select("organization_id")
    .eq("id", season.competition_id)
    .maybeSingle();

  return {
    season: { ...season, competition_id: season.competition_id },
    organizationId: competition?.organization_id ?? null,
  };
}

/**
 * The org's current org-season, used to link newly created competition seasons.
 *
 * A season without `organization_season_id` is invisible to season-scoped reads
 * (`resolveOrgSeasonIds` and the org fixtures endpoint), so the dashboard
 * reports the season as empty even though it holds teams and fixtures.
 *
 * @param sb - Supabase client instance
 * @param organizationId - UUID of the owning organization
 * @returns The org-season id, or null when the org has no current org-season.
 */
export async function resolveCurrentOrgSeasonId(
  sb: SupabaseClient,
  organizationId: string
): Promise<string | null> {
  const { data } = await sb
    .from("organization_seasons")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("is_current", true)
    .maybeSingle();

  return data?.id ?? null;
}

/**
 * Resolve (creating if needed) the org-season a competition season should
 * link to.
 *
 * When `preferredName` is given, the org-season with that exact name is used,
 * creating it if it doesn't exist yet. This keeps every named season (e.g.
 * "2025/2026", "2026/2027") a separately switchable row in the org season
 * selector instead of collapsing all of them into one generic "current"
 * season. A newly created named season is marked current only when the org
 * has no current season yet (enforced one-current-per-org by a partial unique
 * index).
 *
 * When no name is given, this resolves the org's *current* org-season,
 * promoting the most recent one or creating a default — the behaviour the
 * fixture-generation routes rely on.
 *
 * Competition seasons are invisible to season-scoped reads unless they carry
 * `organization_season_id`, so this helper guarantees a link always exists.
 *
 * @param sb - Supabase client instance
 * @param organizationId - UUID of the owning organization
 * @param preferredName - Season name to match (or use when creating)
 * @returns The org-season id (never null unless the insert failed).
 */
export async function ensureCurrentOrgSeason(
  sb: SupabaseClient,
  organizationId: string,
  preferredName?: string
): Promise<string | null> {
  const wanted = preferredName?.trim() || null;

  if (wanted) {
    // Prefer an existing org-season with this exact name so each named season
    // stays separately switchable.
    const { data: named } = await sb
      .from("organization_seasons")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("name", wanted)
      .maybeSingle();
    if (named?.id) return named.id;

    // Not found: create it. It becomes current only if none is current yet.
    const current = await resolveCurrentOrgSeasonId(sb, organizationId);
    const { data: created } = await sb
      .from("organization_seasons")
      .insert({
        organization_id: organizationId,
        name: wanted,
        status: current ? "upcoming" : "active",
        is_current: !current,
      })
      .select("id")
      .single();
    return created?.id ?? null;
  }

  // No name given: resolve the org's current org-season.
  const current = await resolveCurrentOrgSeasonId(sb, organizationId);
  if (current) return current;

  // No current org-season: promote the most recent existing one.
  const { data: existing } = await sb
    .from("organization_seasons")
    .select("id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    await sb
      .from("organization_seasons")
      .update({ is_current: true })
      .eq("id", existing.id);
    return existing.id;
  }

  // None exist at all: create a default current org-season.
  const { data: created } = await sb
    .from("organization_seasons")
    .insert({
      organization_id: organizationId,
      name: `${new Date().getFullYear()} Season`,
      status: "active",
      is_current: true,
    })
    .select("id")
    .single();

  return created?.id ?? null;
}

/**
 * Resolve an org season (`organization_seasons.id`) to the competition
 * `seasons` that belong to it. Optionally verify the org season is owned by a
 * specific organization (used to scope read-only queries by access).
 *
 * @param sb - Supabase client instance
 * @param orgSeasonId - UUID of the `organization_seasons` row
 * @param orgId - Optional owning org to require (`organization_seasons.organization_id`)
 * @returns The matched season IDs, or `[]` when the org season doesn't exist /
 *          belongs to another org / has no competition seasons.
 */
export async function resolveOrgSeasonIds(
  sb: SupabaseClient,
  orgSeasonId: string,
  orgId?: string
): Promise<string[]> {
  let query = sb.from("organization_seasons").select("id").eq("id", orgSeasonId);
  if (orgId) query = query.eq("organization_id", orgId);

  const { data: orgSeason } = await query.maybeSingle();
  if (!orgSeason) return [];

  const { data: seasons } = await sb
    .from("seasons")
    .select("id")
    .eq("organization_season_id", orgSeasonId);
  return (seasons || []).map((s) => s.id as string);
}

/** Resolve a season team's organization via its season + competition. */
export async function resolveSeasonTeamOrganization(sb: SupabaseClient, seasonTeamId: string) {
  const { data: st } = await sb
    .from("season_teams")
    .select("id, season_id, team_id")
    .eq("id", seasonTeamId)
    .maybeSingle();

  if (!st?.season_id) return { seasonTeam: null, organizationId: null };

  const { season, organizationId } = await resolveSeasonOrganization(sb, st.season_id);
  if (!season) return { seasonTeam: null, organizationId: null };

  return { seasonTeam: st, organizationId };
}
