
import { createClient } from '@/lib/supabase/server';
import {
  asInteger,
  asOptionalString,
  asString,
  getAuthContext,
  json,
  logApiError,
  parseJsonObject,
  requireAdmin,
  requireOrgAdmin,
  sanitizeText,
} from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;
    const authed = auth!;

    const teamId = asInteger(params.id, 1);
    if (!teamId) return json({ error: 'Invalid team id.' }, { status: 400 });

    // Fetch team to get organization_id
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('organization_id')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return json({ error: 'Team not found.' }, { status: 404 });
    }

    // If user is not a super admin, check organization admin rights
    if (!authed.isAdmin) {
      const orgAdminError = requireOrgAdmin(authed, team.organization_id);
      if (orgAdminError) return orgAdminError;
    }

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const update: Record<string, unknown> = {};
    const name = asString(parsed.data!.name, 80);
    const logoUrl = asOptionalString(parsed.data!.logo_url ?? parsed.data!.logoUrl, 2048);
    const rating = typeof parsed.data!.rating === 'number' ? parsed.data!.rating : null;
    if (name) update.name = sanitizeText(name);
    if (logoUrl !== null) update.logo_url = logoUrl;
    if (rating !== null && Number.isFinite(rating) && rating >= 0 && rating <= 10) {
      update.rating = rating;
    }
    if (Object.keys(update).length === 0) {
      return json({ error: 'No valid fields to update.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('teams')
      .update(update)
      .eq('id', teamId)
      .select()
      .single();

    if (error) {
      logApiError('team_update_failed', error, { userId: authed.userId, teamId });
      return json({ error: 'Unable to update team.' }, { status: 400 });
    }
    return json({ team: data });
  } catch (error) {
    logApiError('team_update_error', error);
    return json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;
    const authed = auth!;

    const teamId = asInteger(params.id, 1);
    if (!teamId) return json({ error: 'Invalid team id.' }, { status: 400 });

    // Fetch team to get organization_id
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('organization_id')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return json({ error: 'Team not found.' }, { status: 404 });
    }

    // If user is not a super admin, check organization admin rights
    if (!authed.isAdmin) {
      const orgAdminError = requireOrgAdmin(authed, team.organization_id);
      if (orgAdminError) return orgAdminError;
    }

    const { error: meError } = await supabase
      .from('match_events')
      .delete()
      .eq('team_id', teamId);

    if (meError) {
      logApiError('team_delete_match_events_failed', meError, { userId: authed.userId, teamId });
    }

    const { error: lineupError } = await supabase
      .from('team_lineups')
      .delete()
      .eq('team_id', teamId);

    if (lineupError) {
      logApiError('team_delete_lineups_failed', lineupError, { userId: authed.userId, teamId });
    }

    const { error: fixtureError } = await supabase
      .from('fixtures')
      .delete()
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);

    if (fixtureError) {
      logApiError('team_delete_fixtures_failed', fixtureError, { userId: authed.userId, teamId });
    }

    const { error: transferError } = await supabase
      .from('player_transfers')
      .delete()
      .or(`from_team_id.eq.${teamId},to_team_id.eq.${teamId}`);

    if (transferError) {
      logApiError('team_delete_transfers_failed', transferError, { userId: authed.userId, teamId });
    }

    const { error: deleteError } = await supabase
      .from('teams')
      .delete()
      .eq('id', teamId);

    if (deleteError) {
      logApiError('team_delete_failed', deleteError, { userId: authed.userId, teamId });
      return json({ error: 'Unable to delete team.' }, { status: 400 });
    }
    return json({ success: true });
  } catch (error) {
    logApiError('team_delete_error', error);
    return json({ error: 'Internal server error.' }, { status: 500 });
  }
}

