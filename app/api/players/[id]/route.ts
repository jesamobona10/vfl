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

    if (!adminUser && !teamAccount) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch existing player to detect transfers and to enforce team-account restrictions
    const { data: existingPlayer } = await supabase
      .from("players")
      .select("team_id, name")
      .eq("id", params.id)
      .single();

    // If team account, ensure the player belongs to their managed team before allowing updates
    if (teamAccount && !adminUser) {
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
    // If team changed, insert a transfer audit record
    try {
      const oldTeam = existingPlayer?.team_id ?? null;
      const newTeam = data?.team_id ?? null;
      if (oldTeam !== newTeam) {
        await supabase.from("player_transfers").insert({
          player_id: Number(params.id),
          from_team_id: oldTeam,
          to_team_id: newTeam,
          performed_by: session.user.id,
          performed_by_role: adminUser ? "admin" : "team_account",
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
        player_id: Number(params.id),
        player_name: existingPlayer?.name ?? null,
        from_team_id: oldTeam,
        to_team_id: newTeam,
        performed_by: session.user.id,
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
