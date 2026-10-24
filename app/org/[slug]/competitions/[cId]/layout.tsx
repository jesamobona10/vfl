"use client";

import { useCompetition, useSeasons } from "@/lib/hooks/use-competitions";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Calendar, Trophy, Settings, ListOrdered, Users, Shield, LayoutDashboard, BarChart3 } from "lucide-react";
import { PageSkeleton } from "@/components/shared/skeleton";
import { SeasonSelector } from "@/components/competitions/season-selector";
import { Badge } from "@/components/ui/badge";
import { competitionStatusVariant, statusLabel } from "@/lib/status";
import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { useCompetitionOverviewStats } from "@/lib/hooks/use-competition-stats";
import { formatRelativeTime } from "@/lib/utils/helpers";
import { cn } from "@/lib/utils";

const typeLabels: Record<string, string> = {
  league: "League",
  cup: "Cup",
  friendly: "Friendly",
};

const tabs = [
  { href: "", label: "Overview", icon: LayoutDashboard },
  { href: "standings", label: "Standings", icon: Trophy, standingsOnly: true },
  { href: "stats", label: "Statistics", icon: BarChart3 },
  { href: "fixtures", label: "Schedule", icon: Calendar },
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
  const setCurrentSeasonId = useAppStore((s) => s.setCurrentSeasonId);
  const setFixtures = useAppStore((s) => s.setFixtures);
  const setTeams = useAppStore((s) => s.setTeams);
  const setPlayers = useAppStore((s) => s.setPlayers);

  const currentSeason = seasons.find((s) => s.is_current);

  // The URL is the single source of truth for the selected season. Deriving it
  // from the `seasonId` param (instead of mirroring it in component state)
  // avoids the race where a stale param would snap the selection back to the
  // current season for a frame right after the user picks another one.
  const seasonIdParam = searchParams.get("seasonId");
  const requestedSeason = seasonIdParam
    ? seasons.find((season) => season.id === seasonIdParam)
    : undefined;
  const hasValidRequestedSeason = Boolean(requestedSeason);
  const selectedSeasonId =
    requestedSeason?.id ?? currentSeason?.id ?? seasons[0]?.id ?? null;

  const stats = useCompetitionOverviewStats(selectedSeasonId ?? undefined, currentCompetition?.id);

  // Backfill a default (or repair an unknown) season id into the URL so the
  // selection persists across navigation and refresh.
  useEffect(() => {
    if (!selectedSeasonId || hasValidRequestedSeason) return;
    const query = new URLSearchParams(searchParams.toString());
    query.set("seasonId", selectedSeasonId);
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  }, [selectedSeasonId, hasValidRequestedSeason, searchParams, pathname, router]);

  // Reset season-scoped store data whenever the selection changes so no stale
  // or mixed-season data renders while the new season's queries are in flight.
  useEffect(() => {
    setCurrentSeasonId(selectedSeasonId);
    setFixtures([]);
    setTeams([]);
    setPlayers([]);
  }, [selectedSeasonId, setCurrentSeasonId, setFixtures, setPlayers, setTeams]);

  const handleSeasonChange = (seasonId: string) => {
    const query = new URLSearchParams(searchParams.toString());
    query.set("seasonId", seasonId);
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  };

  const basePath = `/org/${slug}/competitions/${cId}`;
  const seasonQuery = selectedSeasonId ? `?seasonId=${selectedSeasonId}` : "";
  const isFriendly = currentCompetition?.type === "friendly";

  useEffect(() => {
    if (isFriendly && pathname.startsWith(`${basePath}/standings`)) {
      router.replace(`${basePath}/fixtures${seasonQuery}`);
    }
  }, [basePath, isFriendly, pathname, router, seasonQuery]);

  if (isLoading || !currentCompetition) {
    return (
      <div className="flex items-center justify-center py-20">
        <PageSkeleton />
      </div>
    );
  }

  if (isFriendly && pathname.startsWith(`${basePath}/standings`)) {
    return null;
  }

  const isActive = (href: string) => {
    if (!href) return pathname === basePath;
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
            <Badge variant={competitionStatusVariant(currentCompetition.status)}>
              {statusLabel(currentCompetition.status)}
            </Badge>
            {currentSeason && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">
                Current Season
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
          {tabs.filter((tab) => !tab.standingsOnly || !isFriendly).map((tab) => {
            const active = isActive(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href || "overview"}
                href={`${basePath}${tab.href ? `/${tab.href}` : ""}${seasonQuery}`}
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
              </Link>
            );
          })}
        </nav>
      </div>

      {children}
    </div>
  );
}
