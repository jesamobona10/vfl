"use client";

import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Trophy, Calendar, Shield, BarChart3, TrendingUp, TrendingDown, Users, Activity } from "lucide-react";
import { useCompetition, useSeasons, useSeasonTeams } from "@/lib/hooks/use-competitions";
import { useCompetitionOverviewStats, usePreviousSeason } from "@/lib/hooks/use-competition-stats";
import { PageSkeleton } from "@/components/shared/skeleton";
import { StandingsTable } from "@/components/standings/standings-table";
import { formatRelativeTime } from "@/lib/utils/helpers";

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

  // Enhanced stats with real counts and trends
  const stats = useCompetitionOverviewStats(currentSeason?.id, competition?.id);
  const previousSeason = usePreviousSeason(competition?.id, currentSeason?.id);

  if (isLoading || !competition) {
    return (
      <div className="flex items-center justify-center py-20">
        <PageSkeleton />
      </div>
    );
  }

  const basePath = `/org/${slug}/competitions/${cId}`;
  const seasonQuery = currentSeason?.id ? `?seasonId=${currentSeason.id}` : "";

  // Calculate trend indicators vs previous season
  // Calculate trend indicators vs previous season
  const getTrend = (current: number, previous: number | null | undefined): { direction: "up" | "down" | "neutral"; diff: number } | null => {
    const prev = previous ?? null;
    if (prev === null || prev === 0) return null;
    if (current > prev) return { direction: "up", diff: current - prev };
    if (current < prev) return { direction: "down", diff: prev - current };
    return { direction: "neutral", diff: 0 };
  };

  const teamTrend = getTrend(stats.teams.active, previousSeason.data?.teams?.active ?? null);
  const fixtureTrend = getTrend(stats.fixtures.completed, previousSeason.data?.fixtures?.completed ?? null);
  const playerTrend = getTrend(stats.players.total, previousSeason.data?.players?.total ?? null);

const statsCards = [
    {
      label: "Teams",
      value: stats.teams.active,
      secondary: stats.teams.total > stats.teams.active ? `${stats.teams.total} total` : null,
      icon: Shield,
      iconColor: "text-brand",
      iconBg: "bg-brand-50",
      href: `${basePath}/teams${seasonQuery}`,
      trend: teamTrend as { direction: "up" | "down" | "neutral"; diff: number } | null,
    },
    {
      label: "Fixtures",
      value: stats.fixtures.completed,
      secondary: `${stats.fixtures.total} total (${stats.fixtures.scheduled} upcoming)`,
      icon: Calendar,
      iconColor: "text-live-500",
      iconBg: "bg-live-tint",
      href: `${basePath}/fixtures${seasonQuery}`,
      trend: fixtureTrend as { direction: "up" | "down" | "neutral"; diff: number } | null,
    },
    {
      label: "Players",
      value: stats.players.total,
      secondary: stats.teams.total > 0 ? `~${Math.round(stats.players.total / stats.teams.active)} per team` : null,
      icon: Users,
      iconColor: "text-gold-500",
      iconBg: "bg-gold-tint",
      href: `${basePath}/players${seasonQuery}`,
      trend: playerTrend as { direction: "up" | "down" | "neutral"; diff: number } | null,
    },
    {
      label: "Live",
      value: stats.hasLiveMatches ? "Live" : "None",
      secondary: stats.fixtures.liveCount > 0 ? `${stats.fixtures.liveCount} in progress` : `${stats.fixtures.inProgress} in progress`,
      icon: Activity,
      iconColor: stats.hasLiveMatches ? "text-live-500" : "text-muted",
      iconBg: stats.hasLiveMatches ? "bg-live-tint" : "bg-surface-2",
      href: `${basePath}/live${seasonQuery}`,
      isLive: stats.hasLiveMatches,
      trend: null,
    },
  ];

  const TrendIcon = ({ trend }: { trend: { direction: "up" | "down" | "neutral"; diff: number } | null }) => {
    if (!trend || trend.direction === "neutral") return <span className="text-muted text-xs">—</span>;
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${trend.direction === "up" ? "text-brand" : "text-danger"}`}>
        {trend.direction === "up" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        <span>{trend.diff}</span>
      </span>
    );
  };

  if (seasons.length === 0) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statsCards.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="card p-5 hover:border-brand/50 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${s.iconBg}`}>
                    <Icon size={18} className={s.iconColor} />
                  </div>
                  {s.isLive && <span className="flex items-center gap-1 text-xs font-medium text-live-500 animate-pulse"><Activity size={10} /> Live</span>}
                </div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-sm text-muted">{s.label}</p>
                {s.secondary && <p className="text-xs text-muted mt-1">{s.secondary}</p>}
              </div>
            );
          })}
        </div>

        <div className="card p-8 sm:p-12 text-center">
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Stats Cards with Trends */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.label}
              href={s.href}
              className="card p-5 hover:border-brand/50 transition-colors block relative overflow-hidden group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${s.iconBg}`}>
                  <Icon size={18} className={s.iconColor} />
                </div>
                {s.isLive && (
                  <span className="flex items-center gap-1 text-xs font-medium text-live-500 animate-pulse">
                    <Activity size={10} />
                    Live
                  </span>
                )}
              </div>
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-sm text-muted">{s.label}</p>
                  {s.secondary && <p className="text-xs text-muted mt-0.5">{s.secondary}</p>}
                </div>
                <TrendIcon trend={s.trend} />
              </div>
              {/* Subtle hover glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-brand/0 to-brand/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </Link>
          );
        })}
      </div>

      {/* Data Freshness Indicator */}
      {stats.lastUpdated && (
        <div className="flex items-center justify-between text-xs text-muted">
          <span>Data updated {formatRelativeTime(stats.lastUpdated)}</span>
          {stats.hasLiveMatches && (
            <span className="flex items-center gap-1 text-live-500 animate-pulse">
              <Activity size={10} />
              Live matches in progress
            </span>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content: Standings (Overview Mode) */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-lg font-semibold">Standings — {currentSeason?.name}</h2>
            <div className="flex items-center gap-2">
              <Link
                href={`${basePath}/standings${seasonQuery}`}
                className="text-sm text-brand hover:underline"
              >
                View full table
              </Link>
            </div>
          </div>
          <StandingsTable overviewMode />
        </div>

        {/* Sidebar: Seasons with Enhanced UX */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Seasons</h2>
            <Link
              href={`${basePath}/settings`}
              className="text-xs text-brand hover:underline"
            >
              Manage
            </Link>
          </div>
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
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium min-w-0 truncate">{s.name}</span>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                    s.status === "active"
                      ? "bg-live-tint text-live-500"
                      : s.status === "completed"
                        ? "bg-brand-50 text-brand-700"
                        : s.status === "draft"
                          ? "bg-surface-2 text-ink-3"
                          : "bg-muted/20 text-muted"
                  }`}
                >
                  {s.status}
                </span>
              </div>
              {s.is_current && (
                <span className="flex items-center gap-1 text-xs font-medium text-brand">
                  <Trophy size={10} className="fill-current" />
                  Current
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}