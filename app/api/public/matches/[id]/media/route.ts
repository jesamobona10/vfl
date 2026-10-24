import { asInteger, json } from "@/lib/security";
import { getVideoEmbedUrl } from "@/lib/match-media";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const matchId = asInteger((await props.params).id, 1);
  if (!matchId) return json({ error: "Invalid match id." }, { status: 400 });
  const supabase = createServiceRoleClient();
  const { data: match } = await supabase.from("public_matches").select("match_id").eq("match_id", matchId).maybeSingle();
  if (!match) return json({ error: "Match not found." }, { status: 404 });
  const { data, error } = await supabase.from("match_media").select("id, match_id, media_type, source_type, url, mime_type, title, caption, created_at").eq("match_id", matchId).order("created_at", { ascending: false }).limit(100);
  if (error) return json({ error: "Unable to load match media." }, { status: 500 });
  return json({ media: (data || []).map((row) => ({ ...row, embed_url: row.source_type === "link" ? getVideoEmbedUrl(row.url) : null })) });
}
