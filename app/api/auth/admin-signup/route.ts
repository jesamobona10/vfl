import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const sb = createServiceRoleClient();

    const { count } = await sb
      .from("admin_users")
      .select("id", { count: "exact", head: true });

    if (count && count > 0) {
      return NextResponse.json(
        { error: "Admin already exists. Use login instead." },
        { status: 409 }
      );
    }

    const { data: authUser, error: createError } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    const { error: insertError } = await sb
      .from("admin_users")
      .insert({ id: authUser.user.id, email });

    if (insertError) {
      await sb.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
