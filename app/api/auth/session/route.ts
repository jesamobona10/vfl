import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("id, email")
      .eq("id", session.user.id)
      .single();

    if (adminUser) {
      return NextResponse.json({
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
      return NextResponse.json({
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

    return NextResponse.json({ authenticated: false }, { status: 401 });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
