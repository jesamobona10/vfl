import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 }
      );
    }

    const sb = createServiceRoleClient();
    const { data: account, error: accountError } = await sb
      .from("team_accounts")
      .select("id, username, display_name, team_id, role")
      .eq("username", username)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 }
      );
    }

    const email = `team_${username.toLowerCase()}@vfl.local`;

    const supabase = await createClient();
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError) {
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user: {
        id: account.id,
        username: account.username,
        displayName: account.display_name,
        teamId: account.team_id,
        role: account.role,
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
