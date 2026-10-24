import { createClient } from "@/lib/supabase/server";
import { asInteger, getAuthContext, json, requireAuth, writeAuditEvent } from "@/lib/security";
import { getManageableFixtureMediaContext } from "@/lib/match-media-access";
import { MATCH_MEDIA_BUCKET } from "@/lib/match-media";

export async function PATCH(request: Request, props: { params: Promise<{ id: string; mediaId: string }> }) {
  const params = await props.params;
  const fixtureId = asInteger(params.id, 1);
  if (!fixtureId || !/^[0-9a-f-]{36}$/i.test(params.mediaId)) {
    return json({ error: "Invalid media id." }, { status: 400 });
  }
  const session = await createClient();
  const auth = await getAuthContext(session);
  const authError = requireAuth(auth);
  if (authError) return authError;
  const access = await getManageableFixtureMediaContext(fixtureId, auth!);
  if (access.response) return access.response;
  if (!access.canPublish) return json({ error: "Only FA administrators can moderate media." }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, { status: 400 });
  }
  const status = (body as { status?: unknown })?.status;
  if (!["pending", "published", "rejected", "hidden"].includes(String(status))) {
    return json({ error: "Invalid publication status." }, { status: 400 });
  }

  const { data: previous, error: loadError } = await access.supabase
    .from("match_media")
    .select("id, status")
    .eq("id", params.mediaId)
    .eq("match_id", fixtureId)
    .maybeSingle();
  if (loadError || !previous) return json({ error: "Media not found." }, { status: 404 });

  const nextStatus = String(status);
  const { data, error } = await access.supabase
    .from("match_media")
    .update({
      status: nextStatus,
      approved_by: nextStatus === "published" ? auth!.userId : null,
      approved_at: nextStatus === "published" ? new Date().toISOString() : null,
    })
    .eq("id", params.mediaId)
    .eq("match_id", fixtureId)
    .select("id, status, approved_by, approved_at")
    .single();
  if (error || !data) return json({ error: "Unable to update media status." }, { status: 500 });

  void writeAuditEvent("MATCH_MEDIA_MODERATED", auth!.userId, access.organizationId, {
    fixture_id: fixtureId,
    media_id: params.mediaId,
    previous_status: previous.status,
    status: nextStatus,
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    user_agent: request.headers.get("user-agent"),
  });
  return json({ media: data });
}

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
  const { data: media, error: loadError } = await access.supabase.from("match_media").select("id, storage_path, thumbnail_path").eq("id", params.mediaId).eq("match_id", fixtureId).maybeSingle();
  if (loadError || !media) return json({ error: "Media not found." }, { status: 404 });
  const objectPaths = [media.storage_path, media.thumbnail_path].filter((path): path is string => Boolean(path));
  if (objectPaths.length) {
    const { error } = await access.supabase.storage.from(MATCH_MEDIA_BUCKET).remove(objectPaths);
    if (error) return json({ error: "Unable to remove the media file." }, { status: 500 });
  }
  const { error } = await access.supabase.from("match_media").delete().eq("id", params.mediaId).eq("match_id", fixtureId);
  if (error) return json({ error: "Unable to remove fixture media." }, { status: 500 });
  void writeAuditEvent("MATCH_MEDIA_DELETED", auth!.userId, access.organizationId, {
    fixture_id: fixtureId,
    media_id: params.mediaId,
    ip: _request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    user_agent: _request.headers.get("user-agent"),
  });
  return json({ success: true });
}
