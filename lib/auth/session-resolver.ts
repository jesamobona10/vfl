import type { SupabaseClient } from "@supabase/supabase-js";
import { logApiError } from "@/lib/security";

/**
 * Session-resolution result shared by the /api/auth/session route and the
 * server-side AuthBootstrap component. Kept in one place so both the HTTP
 * path and the SSR path resolve identities identically.
 */
export type SessionResult =
  | {
      authenticated: true;
      role: string;
      profile: {
        id: string;
        role?: string;
        displayName?: string;
        username?: string;
        teamId?: number;
        playerId?: number | null;
        orgRole?: string;
        org?: { id: string; name: string; slug: string; type: string };
      };
    }
  | { authenticated: false; definitive: boolean };

/**
 * Resolve the current Supabase session into the same shape the app's client
 * store expects (role + profile). Mirrors the logic of the /api/auth/session
 * route exactly; any rarity there is fixed here.
 */
export async function resolveSession(
  supabase: SupabaseClient
): Promise<SessionResult> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return { authenticated: false, definitive: true };
    }

    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("id, email")
      .eq("id", session.user.id)
      .single();

    if (adminUser) {
      return {
        authenticated: true,
        role: "super_admin",
        profile: { id: adminUser.id, role: "super_admin", displayName: adminUser.email },
      };
    }

    const { data: teamAccount } = await supabase
      .from("team_accounts")
      .select("id, username, display_name, team_id, role")
      .eq("id", session.user.id)
      .single();

    if (teamAccount) {
      return {
        authenticated: true,
        role: "team_account",
        profile: {
          id: teamAccount.id,
          role: "team_account",
          displayName: teamAccount.display_name,
          teamId: teamAccount.team_id,
          username: teamAccount.username,
        },
      };
    }

    const { data: playerProfile } = await supabase
      .from("player_profiles")
      .select("id, player_id, display_name, username")
      .eq("id", session.user.id)
      .single();

    if (playerProfile) {
      return {
        authenticated: true,
        role: "player",
        profile: {
          id: playerProfile.id,
          role: "player",
          displayName: playerProfile.display_name,
          username: playerProfile.username,
          playerId: playerProfile.player_id,
        },
      };
    }

    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id, role, organizations(name, slug, type)")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (membership) {
      const org = membership.organizations as unknown as {
        name: string;
        slug: string;
        type: string;
      };
      return {
        authenticated: true,
        role: "org_admin",
        profile: {
          id: session.user.id,
          role: "org_admin",
          displayName: org.name,
          orgRole: membership.role,
          org: { id: membership.organization_id, name: org.name, slug: org.slug, type: org.type },
        },
      };
    }

    return { authenticated: false, definitive: false };
  } catch (error) {
    logApiError("session_resolver_error", error);
    return { authenticated: false, definitive: false };
  }
}