import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAuthContext, json, logApiError, requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    const authError = requireAuth(auth);
    if (authError) return authError;

    const sb = createServiceRoleClient();
    const { data: buckets, error } = await sb.storage.listBuckets();

    if (error) {
      logApiError("bucket_check_failed", error, { userId: auth!.userId });
      return json(
        { exists: false, error: "Failed to check storage bucket." },
        { status: 200 }
      );
    }

    const exists = buckets?.some((b) => b.name === "org-logos") ?? false;

    return json({ exists });
  } catch (err) {
    logApiError("bucket_check_error", err);
    return json(
      { exists: false, error: "Failed to check storage bucket." },
      { status: 200 }
    );
  }
}
