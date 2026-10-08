"use client";

import { useCompetition, useSeasons } from "@/lib/hooks/use-competitions";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Calendar, Trophy, Settings, Activity, ListOrdered, Users, Shield } from "lucide-react";
import { PageSkeleton } from "@/components/shared/skeleton";
import { SeasonSelector } from "@/components/competitions/season-selector";
import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { useCompetitionOverviewStats } from "@/lib/hooks/use-competition-stats";
import { formatRelativeTime } from "@/lib/utils/helpers";
import { cn } from "@/lib/utils";

const typeLabels: Record<string, string> = {
  league: "League",
  cup: "Cup",
  friendly: "Friendly",
};

const statusColors: Record<string, string> = {
  draft: "bg-surface-2 text-ink-3",
  active: "bg-live-tint text-live-500",
  completed: "bg-brand-50 text-brand-700",
  archived: "bg-muted/20 text-muted",
};

const tabs = [
  { href: "standings", label: "Standings", icon: Trophy },
  { href: "fixtures", label: "Schedule", icon: Calendar },
  { href: "live", label: "Live", icon: Activity },
  { href: "teams", label: "Teams", icon: Shield },
  { href: "players", label: "Players", icon: Users },
  { href: "results", label: "Final Match Results", icon: ListOrdered },
  { href: "settings", label: "Settings", icon: Settings },
];

export default function CompetitionLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const cId = params.cId as string;
  const { data: currentCompetition, isLoading } = useCompetition(cId);
  const { data: seasons = [] } = useSeasons(currentCompetition?.id);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const setCurrentSeasonId = useAppStore((s) => s.setCurrentSeasonId);
  const setFixtures = useAppStore((s) => s.setFixtures);
  const setTeams = useAppStore((s) => s.setTeams);
  const setPlayers = useAppStore((s) => s.setPlayers);

  const currentSeason = seasons.find((s) => s.is_current);
  const stats = useCompetitionOverviewStats(selectedSeasonId ?? undefined, currentCompetition?.id);
  const seasonIdParam = searchParams.get("seasonId");

  useEffect(() => {
    if (!seasons.length) return;
    const requestedSeason = seasonIdParam
      ? seasons.find((season) => season.id === seasonIdParam)
      : undefined;
    const nextSeasonId = requestedSeason?.id ?? currentSeason?.id ?? seasons[0]?.id ?? null;
    if (nextSeasonId && nextSeasonId !== selectedSeasonId) {
      setSelectedSeasonId(nextSeasonId);
    }
  }, [currentSeason?.id, seasonIdParam, seasons, selectedSeasonId]);

  useEffect(() => {
    if (selectedSeasonId && seasons.length > 0 && !seasons.some((s) => s.id === selectedSeasonId)) {
      setSelectedSeasonId(null);
    }
  }, [seasons, selectedSeasonId]);

  useEffect(() => {
    setCurrentSeasonId(selectedSeasonId);
    setFixtures([]);
    setTeams([]);
    setPlayers([]);
  }, [selectedSeasonId, setCurrentSeasonId, setFixtures, setPlayers, setTeams]);

  useEffect(() => {
    if (!selectedSeasonId || seasonIdParam === selectedSeasonId) return;
    const query = new URLSearchParams(searchParams.toString());
    query.set("seasonId", selectedSeasonId);
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  }, [pathname, router, searchParams, seasonIdParam, selectedSeasonId]);

  const handleSeasonChange = (seasonId: string) => {
    setSelectedSeasonId(seasonId);
    const query = new URLSearchParams(searchParams.toString());
    query.set("seasonId", seasonId);
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  };

  if (isLoading || !currentCompetition) {
    return (
      <div className="flex items-center justify-center py-20">
        <PageSkeleton />
      </div>
    );
  }

  const basePath = `/org/${slug}/competitions/${cId}`;
  const seasonQuery = selectedSeasonId ? `?seasonId=${selectedSeasonId}` : "";

  const isActive = (href: string) => {
    const target = `${basePath}/${href}`;
    return pathname === target || pathname.startsWith(`${target}/`);
  };

  const seasonSelector = seasons.length > 0 && (
    <SeasonSelector
      seasons={seasons}
      selectedSeasonId={selectedSeasonId}
      onSeasonChange={handleSeasonChange}
    />
  );

  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId) || currentSeason;

  return (
    <div className="space-y-6">
      {/* Competition Header */}
      <div className="flex items-start gap-4">
        {currentCompetition.logo_url && (
          <img
            src={currentCompetition.logo_url}
            alt={currentCompetition.name}
            className="w-14 h-14 rounded-xl object-cover shrink-0"
            width={56}
            height={56}
            decoding="async"
          />
        )}
        <div className="flex flex-col gap-2 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="uppercase tracking-wider text-xs">
              {typeLabels[currentCompetition.type] ?? "Competition"}
            </span>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                statusColors[currentCompetition.status] ?? statusColors.draft
              }`}
            >
              {currentCompetition.status}
            </span>
            {currentSeason && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">
                Current Season
              </span>
            )}
            {stats.hasLiveMatches && (
              <span className="flex items-center gap-1 text-xs font-medium text-live-500 animate-pulse">
                <Activity size={10} />
                Live
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold truncate">{currentCompetition.name}</h1>
          <div className="flex flex-wrap items-center gap-3">
            {seasonSelector}
            {selectedSeason && <span className="text-sm text-muted">{selectedSeason.name}</span>}
            {stats.lastUpdated && (
              <span className="text-xs text-muted hidden sm:inline-flex items-center gap-1">
                Updated {formatRelativeTime(stats.lastUpdated)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Competition Navigation */}
      <div className="overflow-x-auto border-b border-line">
        <nav aria-label="Competition" className="flex min-w-max gap-1">
          {tabs.map((tab) => {
            const active = isActive(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={`${basePath}/${tab.href}${seasonQuery}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors shrink-0",
                  active
                    ? "border-brand text-brand bg-brand-50/30"
                    : "border-transparent text-muted hover:text-text hover:bg-surface-2/50"
                )}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {tab.href === "live" && stats.hasLiveMatches && (
                  <>
                    <span className="relative flex h-2 w-2" aria-hidden="true">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live-500 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-live-500" />
                    </span>
                    <span className="sr-only">— live matches in progress</span>
                  </>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {children}
    </div>
  );
}
