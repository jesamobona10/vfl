import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function POST(request: Request) {
  try {
    const { teamName, password, teamId } = await request.json();

    if (!teamName || !password) {
      return NextResponse.json(
        { error: "Team name and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { error: "Password must be at least 4 characters." },
        { status: 400 }
      );
    }

    const sb = createServiceRoleClient();

    const { count, error: countError } = await sb
      .from("team_accounts")
      .select("id", { count: "exact", head: true });

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    const suffix = String((count || 0) + 1).padStart(3, "0");
    const username = `${teamName.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()}-${suffix}`;
    const email = `team_${username.toLowerCase()}@vfl.local`;

    const { data: authUser, error: createError } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    const { error: insertError } = await sb.from("team_accounts").insert({
      id: authUser.user.id,
      username,
      display_name: teamName,
      team_id: teamId || null,
      role: "team_account",
    });

    if (insertError) {
      await sb.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      account: { username, displayName: teamName, password },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
