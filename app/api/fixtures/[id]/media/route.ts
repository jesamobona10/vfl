import { createClient } from "@/lib/supabase/server";
import { asInteger, getAuthContext, json, parseJsonObject, requireAuth } from "@/lib/security";
import { getManageableFixtureMediaContext } from "@/lib/match-media-access";
import { getVideoEmbedUrl, isMatchMediaMimeType, MATCH_MEDIA_BUCKET } from "@/lib/match-media";

export const dynamic = "force-dynamic";

async function getContext(id: string) {
  const fixtureId = asInteger(id, 1);
  if (!fixtureId) return { error: json({ error: "Invalid fixture id." }, { status: 400 }) };
  const session = await createClient();
  const auth = await getAuthContext(session);
  const authError = requireAuth(auth);
  if (authError) return { error: authError };
  const access = await getManageableFixtureMediaContext(fixtureId, auth!);
  if (access.response) return { error: access.response };
  return { fixtureId, auth: auth!, ...access };
}

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const context = await getContext((await props.params).id);
  if (context.error) return context.error;
  const { data, error } = await context.supabase.from("match_media").select("*").eq("match_id", context.fixtureId).order("created_at", { ascending: false });
  if (error) return json({ error: "Unable to load fixture media." }, { status: 500 });
  return json({ media: (data || []).map((row) => ({ ...row, embed_url: row.source_type === "link" ? getVideoEmbedUrl(row.url) : null })) });
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const context = await getContext((await props.params).id);
  if (context.error) return context.error;
  const parsed = await parseJsonObject(request);
  if (parsed.error) return json({ error: parsed.error }, { status: 400 });
  const body = parsed.data!;
  const sourceType = body.sourceType;
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
  const caption = typeof body.caption === "string" ? body.caption.trim().slice(0, 500) : "";
  let row: Record<string, unknown>;
  if (sourceType === "link") {
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!getVideoEmbedUrl(url)) return json({ error: "Enter a valid YouTube or Vimeo video URL." }, { status: 400 });
    row = { source_type: "link", media_type: "video", url, storage_path: null, mime_type: null };
  } else if (sourceType === "upload") {
    const path = typeof body.path === "string" ? body.path : "";
    const mimeType = typeof body.mimeType === "string" ? body.mimeType : "";
    const expectedPrefix = `${context.organizationId}/${context.fixtureId}/`;
    if (!path.startsWith(expectedPrefix) || path.includes("..") || !isMatchMediaMimeType(mimeType)) {
      return json({ error: "Invalid uploaded media." }, { status: 400 });
    }
    const mediaType = mimeType.startsWith("image/") ? "photo" : "video";
    const { data: file } = await context.supabase.storage.from(MATCH_MEDIA_BUCKET).list(`${context.organizationId}/${context.fixtureId}`);
    if (!file?.some((entry) => path.endsWith(`/${entry.name}`))) return json({ error: "Uploaded file not found." }, { status: 400 });
    const { data } = context.supabase.storage.from(MATCH_MEDIA_BUCKET).getPublicUrl(path);
    row = { source_type: "upload", media_type: mediaType, url: data.publicUrl, storage_path: path, mime_type: mimeType };
  } else return json({ error: "Invalid media source." }, { status: 400 });

  const { data, error } = await context.supabase.from("match_media").insert({
    ...row, match_id: context.fixtureId, organization_id: context.organizationId,
    title: title || (row.media_type === "photo" ? "Match photo" : "Match video"),
    caption, created_by: context.auth.userId,
  }).select("*").single();
  if (error || !data) return json({ error: "Unable to save fixture media." }, { status: 500 });
  return json({ media: { ...data, embed_url: data.source_type === "link" ? getVideoEmbedUrl(data.url) : null } }, { status: 201 });
}
