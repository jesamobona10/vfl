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
      return json({ authenticated: false });
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

    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id, role, organizations(name, slug, type)")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (membership) {
      const org = membership.organizations as unknown as { name: string; slug: string; type: string };
      return json({
        authenticated: true,
        role: "org_admin",
        profile: {
          id: session.user.id,
          role: "org_admin",
          displayName: org.name,
          orgRole: membership.role,
          org: { id: membership.organization_id, name: org.name, slug: org.slug, type: org.type },
        },
      });
    }

    return json({ authenticated: false });
  } catch (error) {
    logApiError("session_lookup_error", error);
    return json({ authenticated: false }, { status: 500 });
  }
}
