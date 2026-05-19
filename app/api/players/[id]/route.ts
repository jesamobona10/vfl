import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("id")
      .eq("id", session.user.id)
      .single();

    const { data: teamAccount } = await supabase
      .from("team_accounts")
      .select("id, team_id")
      .eq("id", session.user.id)
      .single();

    // If team account, ensure the player belongs to their managed team before allowing updates
    if (teamAccount && !adminUser) {
      const { data: existingPlayer } = await supabase
        .from("players")
        .select("team_id")
        .eq("id", params.id)
        .single();
      if (!existingPlayer || existingPlayer.team_id !== teamAccount.team_id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const { data, error } = await supabase
      .from("players")
      .update(body)
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ player: data });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("id")
      .eq("id", session.user.id)
      .single();

    if (!adminUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabase
      .from("players")
      .delete()
      .eq("id", params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
