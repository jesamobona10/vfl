import { createClient } from "@/lib/supabase/server";
import { asInteger, getAuthContext, json, parseJsonObject, requireAuth, logApiError } from "@/lib/security";
import { getManageableFixtureMediaContext } from "@/lib/match-media-access";
import { MATCH_MEDIA_BUCKET } from "@/lib/match-media";

export const dynamic = "force-dynamic";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const fixtureId = asInteger((await props.params).id, 1);
  if (!fixtureId) return json({ error: "Invalid fixture id." }, { status: 400 });
  const session = await createClient();
  const auth = await getAuthContext(session);
  const authError = requireAuth(auth);
  if (authError) return authError;
  const access = await getManageableFixtureMediaContext(fixtureId, auth!);
  if (access.response) return access.response;

  const parsed = await parseJsonObject(request);
  if (parsed.error) return json({ error: parsed.error }, { status: 400 });
  const expectedPrefix = `${access.organizationId}/${fixtureId}/`;
  const paths = [parsed.data!.path, parsed.data!.thumbnailPath].filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );
  if (!paths.length || paths.length > 2) return json({ error: "Invalid cleanup paths." }, { status: 400 });
  for (const path of paths) {
    const basename = path.startsWith(expectedPrefix) ? path.slice(expectedPrefix.length) : "";
    if (
      !basename || basename.includes("/") || path.includes("..") ||
      !/^(?:[0-9a-f-]{36}\.[a-z0-9]+|[0-9a-f-]{36}-poster\.webp)$/i.test(basename)
    ) return json({ error: "Invalid cleanup path." }, { status: 400 });
  }

  const { data: referenced } = await access.supabase
    .from("match_media")
    .select("storage_path, thumbnail_path")
    .eq("match_id", fixtureId);
  const referencedPaths = new Set((referenced || []).flatMap((item: any) => [item.storage_path, item.thumbnail_path]));
  const unreferencedPaths = paths.filter((path) => !referencedPaths.has(path));
  if (!unreferencedPaths.length) return json({ success: true, removed: 0 });
  const { error } = await access.supabase.storage.from(MATCH_MEDIA_BUCKET).remove(unreferencedPaths);
  if (error) {
    logApiError("match_media_orphan_cleanup_failed", error, {
      fixtureId,
      organizationId: access.organizationId,
      objectPaths: unreferencedPaths,
    });
    return json({ error: "Media details could not be saved and the uploaded file needs cleanup." }, { status: 500 });
  }
  return json({ success: true, removed: unreferencedPaths.length });
}
