import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  asBoolean,
  asInteger,
  asString,
  actorRole,
  getAuthContext,
  getClientIp,
  json,
  logApiError,
  logSecurityEvent,
  ownsTeam,
  parseJsonObject,
  rateLimit,
  rateLimitResponse,
  requireOrgAdmin,
  requireAuth,
  sanitizeText,
  writeAuditRecord,
} from "@/lib/security";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const ip = getClientIp(request);
    const limited = await rateLimit({ key: `player_update:${ip}`, limit: 20, windowMs: 60_000 });
    if (limited.limited) return rateLimitResponse(limited.resetAt);
    const supabase = await createClient();
    const playerId = asInteger(params.id, 1);
    if (!playerId) return json({ error: "Invalid player id." }, { status: 400 });

    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;
    const authed = auth!;

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    // Fetch existing player to detect transfers and to enforce team-account restrictions
    const { data: existingPlayer, error: existingError } = await supabase
      .from("players")
      .select("team_id, name, teams(organization_id)")
      .eq("id", playerId)
      .maybeSingle();

    if (existingError || !existingPlayer) {
      return json({ error: "Player not found." }, { status: 404 });
    }

    // If team account, ensure the player belongs to their managed team before allowing updates
    if (!ownsTeam(authed, existingPlayer.team_id)) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    const update: Record<string, unknown> = {};
    const name = asString(parsed.data!.name, 80);
    const position = asString(parsed.data!.position, 40);
    const jerseyNumber = asInteger(parsed.data!.jersey_number ?? parsed.data!.jerseyNumber, 0, 999);
    const isCaptain = asBoolean(parsed.data!.is_captain ?? parsed.data!.isCaptain);
    const teamId = asInteger(parsed.data!.team_id ?? parsed.data!.teamId, 1);
    if (name) update.name = sanitizeText(name);
    if (position) update.position = sanitizeText(position);
    if (jerseyNumber !== null) update.jersey_number = jerseyNumber;
    if (isCaptain !== null) update.is_captain = isCaptain;
    if (authed.isAdmin && teamId !== null) {
      update.team_id = teamId;
    } else if (!authed.isAdmin && teamId !== null && teamId !== existingPlayer.team_id) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    for (const key of [
      "goals",
      "assists",
      "yellow_cards",
      "red_cards",
      "saves",
      "tackles",
      "clean_sheets",
    ]) {
      const value = asInteger(parsed.data![key], 0, 999);
      if (value !== null) update[key] = value;
    }
    const rating = typeof parsed.data!.rating === "number" ? parsed.data!.rating : null;
    if (rating !== null && Number.isFinite(rating) && rating >= 0 && rating <= 10) {
      update.rating = rating;
    }

    if (Object.keys(update).length === 0) {
      return json({ error: "No valid fields to update." }, { status: 400 });
    }

    if (isCaptain && teamId) {
      const sb = createServiceRoleClient();
      await sb
        .from("players")
        .update({ is_captain: false })
        .eq("team_id", teamId)
        .neq("id", playerId);
    }

    const { data, error } = await supabase
      .from("players")
      .update(update)
      .eq("id", playerId)
      .select()
      .single();

    if (error) {
      logApiError("player_update_failed", error, { userId: authed.userId, playerId });
      return json({ error: "Unable to update player." }, { status: 400 });
    }

    const playerOrgId =
      (existingPlayer?.teams as unknown as { organization_id: string } | null)?.organization_id ??
      null;

    void writeAuditRecord({
      organizationId: playerOrgId,
      actorId: authed.userId,
      actorRole: actorRole(authed),
      action: AUDIT_ACTIONS.PLAYER_UPDATED,
      resourceType: "PLAYER",
      resourceId: playerId,
      description: `Updated player ${data.name ?? existingPlayer?.name}`,
      before: { name: existingPlayer?.name, team_id: existingPlayer?.team_id },
      after: {
        name: data.name,
        team_id: data.team_id,
        position: data.position,
        jersey_number: data.jersey_number,
        is_captain: data.is_captain,
      },
      metadata: {
        teamChanged: (existingPlayer?.team_id ?? null) !== (data?.team_id ?? null),
      },
      ip,
    }).catch(() => {});

    // If team changed, insert a transfer audit record
    try {
      const oldTeam = existingPlayer?.team_id ?? null;
      const newTeam = data?.team_id ?? null;
      if (oldTeam !== newTeam) {
        await supabase.from("player_transfers").insert({
          player_id: playerId,
          from_team_id: oldTeam,
          to_team_id: newTeam,
          performed_by: authed.userId,
          performed_by_role: authed.isAdmin ? "admin" : "team_account",
        });
      }
    } catch (e) {
      // Don't block the response if audit insert fails
      console.error("Failed to record transfer:", e);
    }

    // Insert notifications for involved teams (non-blocking)
    try {
      const oldTeam = existingPlayer?.team_id ?? null;
      const newTeam = data?.team_id ?? null;
      const payload = {
        player_id: playerId,
        player_name: existingPlayer?.name ?? null,
        from_team_id: oldTeam,
        to_team_id: newTeam,
        performed_by: authed.userId,
      };
      if (oldTeam) {
        await supabase.from("notifications").insert({
          team_id: oldTeam,
          type: "player_transfer_out",
          payload,
        });
      }
      if (newTeam) {
        await supabase.from("notifications").insert({
          team_id: newTeam,
          type: "player_transfer_in",
          payload,
        });
      }
    } catch (e) {
      console.error("Failed to insert notifications:", e);
    }

    return json({ player: data });
  } catch (error) {
    logApiError("player_update_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const ip = getClientIp(request);
    const limited = await rateLimit({ key: `player_delete:${ip}`, limit: 10, windowMs: 60_000 });
    if (limited.limited) return rateLimitResponse(limited.resetAt);
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;
    const authed = auth!;

    const playerId = asInteger(params.id, 1);
    if (!playerId) return json({ error: "Invalid player id." }, { status: 400 });

    const sb = createServiceRoleClient();
    const { data: player } = await sb
      .from("players")
      .select("team_id, teams(organization_id)")
      .eq("id", playerId)
      .single();

    if (!player) return json({ error: "Player not found." }, { status: 404 });

    if (!authed.isAdmin) {
      const orgId = (player.teams as unknown as { organization_id: string } | null)
        ?.organization_id;
      if (!orgId) return json({ error: "Forbidden" }, { status: 403 });
      const orgAdminError = requireOrgAdmin(authed, orgId);
      if (orgAdminError) return orgAdminError;
    }

    const { error } = await supabase.from("players").delete().eq("id", playerId);

    if (error) {
      logApiError("player_delete_failed", error, { userId: authed.userId, playerId });
      return json({ error: "Unable to delete player." }, { status: 400 });
    }
    return json({ success: true });
  } catch (error) {
    logApiError("player_delete_error", error);
    return json({ error: "Internal server error." }, { status: 500 });
  }
}
