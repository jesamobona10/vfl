import { asInteger, json } from "@/lib/security";
import { getVideoEmbedUrl } from "@/lib/match-media";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const matchId = asInteger((await props.params).id, 1);
  if (!matchId) return json({ error: "Invalid match id." }, { status: 400 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "all";
  if (!["all", "photo", "video"].includes(type)) {
    return json({ error: "Media type must be all, photo, or video." }, { status: 400 });
  }
  const requestedLimit = Number(url.searchParams.get("limit") || 12);
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(24, Math.trunc(requestedLimit)))
    : 12;
  const requestedOffset = Number(url.searchParams.get("offset") || 0);
  const offset = Number.isSafeInteger(requestedOffset) && requestedOffset >= 0
    ? Math.min(requestedOffset, 100_000)
    : 0;

  const supabase = createServiceRoleClient();
  const { data: match } = await supabase
    .from("public_matches")
    .select("match_id")
    .eq("match_id", matchId)
    .maybeSingle();
  if (!match) return json({ error: "Match not found." }, { status: 404 });

  let query = supabase
    .from("match_media")
    .select(
      "id, match_id, media_type, source_type, url, storage_path, thumbnail_path, mime_type, title, caption, category, file_size_bytes, duration_seconds, width, height, alt_text, sort_order, created_at",
      { count: "exact" }
    )
    .eq("match_id", matchId)
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (type !== "all") query = query.eq("media_type", type);
  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) return json({ error: "Unable to load match media." }, { status: 500 });

  const media = (data || []).map((row) => ({
    id: row.id,
    match_id: row.match_id,
    media_type: row.media_type,
    source_type: row.source_type,
    url: row.url,
    embed_url: row.source_type === "link" ? getVideoEmbedUrl(row.url) : null,
    thumbnail_url: row.thumbnail_path
      ? supabase.storage.from("match-media").getPublicUrl(row.thumbnail_path).data.publicUrl
      : null,
    mime_type: row.mime_type,
    title: row.title,
    caption: row.caption,
    category: row.category,
    file_size_bytes: row.file_size_bytes,
    duration_seconds: row.duration_seconds,
    width: row.width,
    height: row.height,
    alt_text: row.alt_text,
    sort_order: row.sort_order,
    created_at: row.created_at,
  }));

  const hasMore = count != null ? offset + media.length < count : media.length === limit;
  const response = json({ media, hasMore, nextOffset: hasMore ? offset + media.length : null });
  response.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  return response;
}
