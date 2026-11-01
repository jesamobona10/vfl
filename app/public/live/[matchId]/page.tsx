import { LiveMatchClient } from "@/components/public/live-match-client";
import { getPublicMatchDetail } from "@/lib/public/server-fetchers";

export const revalidate = 30;

export default async function PublicLiveMatchPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const data = await getPublicMatchDetail(matchId);
  return <LiveMatchClient initialData={data} matchId={matchId} />;
}
