import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { buildPublicMatchMetadata } from "@/lib/public-match-metadata";
import type { PublicMatchRow } from "@/lib/types";

async function loadMatch(matchId: string): Promise<PublicMatchRow | null> {
  const id = Number(matchId);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const { data } = await createPublicClient()
    .from("public_matches")
    .select("*")
    .eq("match_id", id)
    .maybeSingle();
  return (data as PublicMatchRow | null) ?? null;
}

/**
 * Public match metadata. Only team names and the scoreline are exposed — never
 * player names — so link previews are safe regardless of the organization's
 * `public_player_names_enabled` setting.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ matchId: string }>;
}): Promise<Metadata> {
  const { matchId } = await params;
  return buildPublicMatchMetadata(await loadMatch(matchId));
}

export default function PublicLiveMatchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
