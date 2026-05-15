import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 401 });
    }

    const { data: adminUser, error: adminError } = await supabase
      .from("admin_users")
      .select("id, email")
      .eq("id", authData.user.id)
      .single();

    if (adminError || !adminUser) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "Not authorized as admin." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      user: { id: adminUser.id, email: adminUser.email, role: "super_admin" },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
