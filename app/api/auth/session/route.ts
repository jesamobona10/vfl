import { createClient } from "@/lib/supabase/server";
import { json, logApiError } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return json({ authenticated: false }, { status: 401 });
    }

    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("id, email")
      .eq("id", session.user.id)
      .single();

    if (adminUser) {
      return json({
        authenticated: true,
        role: "super_admin",
        profile: { id: adminUser.id, role: "super_admin", displayName: adminUser.email },
      });
    }

    const { data: teamAccount } = await supabase
      .from("team_accounts")
      .select("id, username, display_name, team_id, role")
      .eq("id", session.user.id)
      .single();

    if (teamAccount) {
      return json({
        authenticated: true,
        role: "team_account",
        profile: {
          id: teamAccount.id,
          role: "team_account",
          displayName: teamAccount.display_name,
          teamId: teamAccount.team_id,
          username: teamAccount.username,
        },
      });
    }

    const { data: playerProfile } = await supabase
      .from("player_profiles")
      .select("id, player_id, display_name, username")
      .eq("id", session.user.id)
      .single();

    if (playerProfile) {
      return json({
        authenticated: true,
        role: "player",
        profile: {
          id: playerProfile.id,
          role: "player",
          displayName: playerProfile.display_name,
          username: playerProfile.username,
          playerId: playerProfile.player_id,
        },
      });
    }

    return json({ authenticated: false }, { status: 401 });
  } catch (error) {
    logApiError("session_lookup_error", error);
    return json({ authenticated: false }, { status: 500 });
  }
}
