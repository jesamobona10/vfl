"use client";

import { StandingsTable } from "@/components/standings/standings-table";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import type { SeasonTeam } from "@/lib/types";
import { LoadingState } from "@/components/shared/skeleton";

export default function CompStandingsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const cId = params.cId as string;
  const seasonId = searchParams.get("seasonId");
  const setFixtures = useAppStore((s) => s.setFixtures);
  const setTeams = useAppStore((s) => s.setTeams);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams({ competition_id: cId });
    if (seasonId) q.set("season_id", seasonId);

    Promise.all([
      fetch(`/api/organizations/${slug}/fixtures?${q.toString()}`).then((r) => r.json()),
      fetch(`/api/seasons/${seasonId}/teams`)
        .then((r) => r.json())
        .catch(() => ({ teams: [] })),
    ])
      .then(([fixturesData, teamsData]) => {
        if (!cancelled) {
          if (fixturesData.fixtures?.length) setFixtures(fixturesData.fixtures);
          if (teamsData.teams?.length) {
            const resolved = teamsData.teams.map(
              (st: SeasonTeam & { team?: SeasonTeam["team"] }) => st.team ?? st
            );
            setTeams(resolved);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, cId, seasonId]);

  if (loading) return <LoadingState label="Loading standings" />;

  return (
    <div>
      <StandingsTable />
    </div>
  );
}
