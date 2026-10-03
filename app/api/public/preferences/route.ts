import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext, json, logApiError, requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

function asPreferences(row: {
  display_name: string | null;
  organization_id: string;
  team_ids: number[] | null;
  reminder_minutes: number[] | null;
}) {
  return {
    displayName: row.display_name || "",
    organizationId: row.organization_id,
    teamIds: row.team_ids || [],
    reminderMinutes: row.reminder_minutes || [60, 30, 15],
  };
}

async function currentAccountDefaults(auth: NonNullable<Awaited<ReturnType<typeof getAuthContext>>>) {
  const service = createServiceRoleClient();
  let organizationId: string | null = auth.orgMembership?.organization_id || null;
  let teamId: number | null = auth.teamAccount?.team_id || null;
  let displayName = "";

  if (auth.orgMembership) {
    const { data } = await service.from("organizations").select("name").eq("id", auth.orgMembership.organization_id).maybeSingle();
    displayName = data?.name || "";
  } else if (auth.isAdmin) {
    const { data } = await service.from("admin_users").select("email").eq("id", auth.userId).maybeSingle();
    displayName = data?.email || "";
  }

  if (auth.teamAccount) {
    const { data } = await service.from("team_accounts").select("display_name, team_id").eq("id", auth.userId).maybeSingle();
    displayName = data?.display_name || "";
    teamId = data?.team_id ?? teamId;
  } else if (!auth.orgMembership && !auth.isAdmin) {
    const { data: profile } = await service.from("player_profiles").select("display_name, player_id").eq("id", auth.userId).maybeSingle();
    displayName = profile?.display_name || "";
    if (profile?.player_id) {
      const { data: player } = await service.from("players").select("team_id").eq("id", profile.player_id).maybeSingle();
      teamId = player?.team_id ?? null;
    }
  }

  if (teamId) {
    const { data: team } = await service.from("teams").select("organization_id").eq("id", teamId).maybeSingle();
    organizationId = team?.organization_id || organizationId;
  }

  return organizationId ? {
    displayName,
    organizationId,
    teamIds: teamId ? [teamId] : [],
    reminderMinutes: [60, 30, 15],
  } : null;
}

export async function GET() {
  try {
    const authClient = await createClient();
    const auth = await getAuthContext(authClient);
    const authError = requireAuth(auth);
    if (authError) return authError;

    const service = createServiceRoleClient();
    const { data, error } = await service
      .from("user_public_preferences")
      .select("display_name, organization_id, team_ids, reminder_minutes")
      .eq("user_id", auth!.userId)
      .maybeSingle();
    if (error) throw error;
    return json({ preferences: data ? asPreferences(data) : await currentAccountDefaults(auth!) });
  } catch (error) {
    logApiError("public_preferences_load_failed", error);
    return json({ error: "Unable to load your match preferences." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const authClient = await createClient();
    const auth = await getAuthContext(authClient);
    const authError = requireAuth(auth);
    if (authError) return authError;
    const body = await request.json();
    const displayName = typeof body?.displayName === "string" ? body.displayName.trim().slice(0, 80) : "";
    const organizationId = body?.organizationId;
    const teamIds: number[] = Array.isArray(body?.teamIds) ? body.teamIds : [];
    const requestedReminders: number[] = Array.isArray(body?.reminderMinutes) ? body.reminderMinutes : [];
    const reminderMinutes = [...new Set(requestedReminders)].filter((value) => [60, 30, 15].includes(value));
    if (
      typeof organizationId !== "string" || !/^[0-9a-f-]{36}$/i.test(organizationId) ||
      teamIds.length > 50 || teamIds.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
      requestedReminders.some((value) => ![60, 30, 15].includes(value))
    ) return json({ error: "Invalid public match preferences." }, { status: 400 });

    const service = createServiceRoleClient();
    const { data: matches, error: matchesError } = await service
      .from("public_matches")
      .select("home_team_id, away_team_id")
      .eq("organization_id", organizationId);
    if (matchesError) throw matchesError;
    if (!matches?.length) return json({ error: "Choose an organization with public matches." }, { status: 400 });
    const eligibleTeamIds = new Set(matches.flatMap((match) => [match.home_team_id, match.away_team_id]).filter((id): id is number => typeof id === "number"));
    if (teamIds.some((id) => !eligibleTeamIds.has(id))) return json({ error: "One or more selected teams are unavailable." }, { status: 400 });

    const { error } = await service.from("user_public_preferences").upsert({
      user_id: auth!.userId,
      display_name: displayName || null,
      organization_id: organizationId,
      team_ids: [...new Set(teamIds)],
      reminder_minutes: reminderMinutes,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) throw error;
    return json({ saved: true, preferences: { displayName, organizationId, teamIds: [...new Set(teamIds)], reminderMinutes } });
  } catch (error) {
    logApiError("public_preferences_save_failed", error);
    return json({ error: "Unable to save your match preferences." }, { status: 500 });
  }
}
