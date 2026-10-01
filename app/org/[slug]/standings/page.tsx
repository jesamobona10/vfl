"use client";

import { useParams } from "next/navigation";
import { StandingsTable } from "@/components/standings/standings-table";
import { SeasonEmptyState } from "@/components/dashboard/season-empty-state";
import { useOrgSeason } from "@/components/competitions/org-season-provider";
import { useAppStore } from "@/lib/store";

export default function OrgStandingsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { selectedSeasonName, loading: seasonLoading, hasTeams, hasFixtures, isOrgAdmin } = useOrgSeason();
  const currentOrg = useAppStore((s) => s.currentOrg);

  return (
    <div className="space-y-5">
      <div className="page-head">
        <div>
          <p className="page-title">Standings</p>
          <p className="page-sub">League table and positions</p>
        </div>
      </div>

      {isOrgAdmin && !seasonLoading && !hasFixtures && (
        <SeasonEmptyState
          hasTeams={hasTeams}
          sheetHref={`/org/${slug}/teams`}
          fixturesHref={`/org/${slug}/fixtures`}
        />
      )}

      <StandingsTable seasonName={selectedSeasonName ?? undefined} leagueName={currentOrg?.name} />
    </div>
  );
}
