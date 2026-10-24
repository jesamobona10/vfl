import { createClient } from "@/lib/supabase/server";
import { asInteger, getAuthContext, json, requireAuth } from "@/lib/security";
import { getManageableFixtureMediaContext } from "@/lib/match-media-access";
import { MATCH_MEDIA_BUCKET } from "@/lib/match-media";

export async function DELETE(_request: Request, props: { params: Promise<{ id: string; mediaId: string }> }) {
  const params = await props.params;
  const fixtureId = asInteger(params.id, 1);
  if (!fixtureId || !/^[0-9a-f-]{36}$/i.test(params.mediaId)) return json({ error: "Invalid media id." }, { status: 400 });
  const session = await createClient();
  const auth = await getAuthContext(session);
  const authError = requireAuth(auth);
  if (authError) return authError;
  const access = await getManageableFixtureMediaContext(fixtureId, auth!);
  if (access.response) return access.response;
  const { data: media, error: loadError } = await access.supabase.from("match_media").select("id, storage_path").eq("id", params.mediaId).eq("match_id", fixtureId).maybeSingle();
  if (loadError || !media) return json({ error: "Media not found." }, { status: 404 });
  if (media.storage_path) {
    const { error } = await access.supabase.storage.from(MATCH_MEDIA_BUCKET).remove([media.storage_path]);
    if (error) return json({ error: "Unable to remove the media file." }, { status: 500 });
  }
  const { error } = await access.supabase.from("match_media").delete().eq("id", params.mediaId).eq("match_id", fixtureId);
  if (error) return json({ error: "Unable to remove fixture media." }, { status: 500 });
  return json({ success: true });
}
