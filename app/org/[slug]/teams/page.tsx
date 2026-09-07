"use client";

import { useParams } from "next/navigation";
import { TeamForm } from "@/components/teams/team-form";
import { SeasonEmptyState } from "@/components/dashboard/season-empty-state";
import { useOrgSeason } from "@/components/competitions/org-season-provider";

export default function OrgTeamsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const {
    selectedOrgSeasonId,
    loading: seasonLoading,
    hasTeams,
    isOrgAdmin,
  } = useOrgSeason();

  return (
    <div className="space-y-5">
      {isOrgAdmin && selectedOrgSeasonId && !seasonLoading && !hasTeams && (
        <SeasonEmptyState
          hasTeams={false}
          sheetHref={`/org/${slug}/teams`}
          fixturesHref={`/org/${slug}/fixtures`}
        />
      )}
      <TeamForm orgSeasonId={selectedOrgSeasonId} />
    </div>
  );
}