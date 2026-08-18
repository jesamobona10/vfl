"use client";

import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Trophy, Calendar, Shield, BarChart3 } from "lucide-react";
import { useCompetition, useSeasons, useSeasonTeams } from "@/lib/hooks/use-competitions";
import { PageSkeleton } from "@/components/shared/skeleton";
import { StandingsTable } from "@/components/standings/standings-table";

export default function CompetitionOverviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const cId = params.cId as string;
  const seasonId = searchParams.get("seasonId");

  const { data: competition, isLoading } = useCompetition(cId);
  const { data: seasons = [] } = useSeasons(competition?.id);

  const currentSeason = useMemo(
    () => seasons.find((s) => s.id === seasonId) || seasons.find((s) => s.is_current) || seasons[0],
    [seasons, seasonId]
  );

  const { data: seasonTeams = [] } = useSeasonTeams(currentSeason?.id);

  if (isLoading || !competition) {
    return (
      <div className="flex items-center justify-center py-20">
        <PageSkeleton />
      </div>
    );
  }

  const basePath = `/org/${slug}/competitions/${cId}`;
  const seasonQuery = currentSeason?.id ? `?seasonId=${currentSeason.id}` : "";

  const stats = [
    {
      label: "Teams",
      value: seasonTeams.length,
      icon: Shield,
      href: `${basePath}/teams${seasonQuery}`,
    },
    {
      label: "Fixtures",
      value: "View",
      icon: Calendar,
      href: `${basePath}/fixtures${seasonQuery}`,
    },
    { label: "Players", value: "View", icon: BarChart3, href: `${basePath}/players${seasonQuery}` },
    { label: "Statistics", value: "View", icon: Trophy, href: `${basePath}/stats${seasonQuery}` },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.label}
              href={s.href}
              className="card p-5 hover:border-brand/50 transition-colors block"
            >
              <div className="flex items-center justify-between mb-3">
                <Icon size={18} className="text-muted" />
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-sm text-muted">{s.label}</p>
            </Link>
          );
        })}
      </div>

      {seasons.length === 0 ? (
        <div className="card p-12 text-center">
          <Trophy size={48} className="mx-auto text-ink-3/40 mb-4" />
          <h2 className="text-lg font-semibold mb-1">No seasons yet</h2>
          <p className="text-sm text-muted mb-6">
            Create a season to start organizing fixtures, teams, and results.
          </p>
          <Link
            href={`${basePath}/settings`}
            className="btn-primary inline-flex items-center gap-2"
          >
            Manage Seasons
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Standings — {currentSeason?.name}</h2>
              <Link
                href={`${basePath}/standings${seasonQuery}`}
                className="text-sm text-brand hover:underline"
              >
                View all
              </Link>
            </div>
            <StandingsTable />
          </div>

          <div className="card p-6 space-y-4">
            <h2 className="text-lg font-semibold">Seasons</h2>
            {seasons.map((s) => (
              <Link
                key={s.id}
                href={`${basePath}/fixtures?seasonId=${s.id}`}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  s.id === currentSeason?.id
                    ? "border-brand/50 bg-brand-50/50"
                    : "border-line hover:border-brand/30"
                }`}
              >
                <span className="text-sm font-medium">{s.name}</span>
                {s.is_current && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">
                    Current
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
