"use client";

import { StandingsTable } from "@/components/standings/standings-table";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useCompetition, useSeasons } from "@/lib/hooks/use-competitions";
import type { SeasonTeam } from "@/lib/types";
import { LoadingState, EmptyState } from "@/components/shared/skeleton";
import { calculateStandings } from "@/lib/logic/standings";

export default function CompStandingsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const cId = params.cId as string;
  const seasonId = searchParams.get("seasonId");
  const setFixtures = useAppStore((s) => s.setFixtures);
  const setTeams = useAppStore((s) => s.setTeams);
  const setPlayers = useAppStore((s) => s.setPlayers);
  const fixtures = useAppStore((s) => s.fixtures);
  const teams = useAppStore((s) => s.teams);
  const [loading, setLoading] = useState(true);

  const { data: competition } = useCompetition(cId);
  const { data: seasons = [] } = useSeasons(cId);
  const currentSeason = seasons.find((s) => s.id === seasonId) || seasons.find((s) => s.is_current) || seasons[0];
  const seasonName = currentSeason?.name;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFixtures([]);
    setTeams([]);
    setPlayers([]);
    if (!seasonId) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }
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
          setFixtures(Array.isArray(fixturesData.fixtures) ? fixturesData.fixtures : []);
          if (Array.isArray(teamsData.teams)) {
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
  }, [slug, cId, seasonId, setFixtures, setPlayers, setTeams]);

  if (loading) return <LoadingState label="Loading standings" />;

  const standings = calculateStandings(teams, fixtures);

  if (!standings.length) {
    return (
      <div className="card p-8 sm:p-12 text-center">
        <EmptyState
          title="No standings data available"
          description="Register teams and generate fixtures to build the league table."
        />
      </div>
    );
  }

  return (
    <div>
      <StandingsTable seasonName={seasonName} leagueName={competition?.name} />
    </div>
  );
}
