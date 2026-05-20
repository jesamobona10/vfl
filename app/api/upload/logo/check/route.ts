import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAuthContext, json, logApiError, requireAdmin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const adminError = requireAdmin(auth);
    if (adminError) return adminError;

    const sb = createServiceRoleClient();
    const { data: buckets, error } = await sb.storage.listBuckets();

    if (error) {
      logApiError("bucket_check_failed", error, { userId: auth!.userId });
      return json(
        { exists: false, error: "Failed to check storage bucket." },
        { status: 200 }
      );
    }

    const exists = buckets?.some((b) => b.name === "team-logos") ?? false;

    return json({ exists });
  } catch (err) {
    logApiError("bucket_check_error", err);
    return json(
      { exists: false, error: "Failed to check storage bucket." },
      { status: 200 }
    );
  }
}
