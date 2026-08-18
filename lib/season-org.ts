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
