"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useSeasons } from "@/lib/hooks/use-competitions";
import { LoadingState } from "@/components/shared/skeleton";
import { TeamOfRound } from "@/components/awards/team-of-round";

export default function TeamOfRoundPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const competitionId = params.cId as string;
  const seasonIdParam = searchParams.get("seasonId");
  const { data: seasons = [], isLoading } = useSeasons(competitionId);

  const requestedSeason = seasonIdParam
    ? seasons.find((season) => season.id === seasonIdParam)
    : undefined;
  const seasonId =
    requestedSeason?.id ??
    seasons.find((season) => season.is_current)?.id ??
    seasons[0]?.id ??
    null;

  if (isLoading) return <LoadingState label="Loading season" />;

  return <TeamOfRound competitionId={competitionId} seasonId={seasonId} />;
}
