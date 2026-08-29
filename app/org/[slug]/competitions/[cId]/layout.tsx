"use client";

import { useCompetition, useSeasons } from "@/lib/hooks/use-competitions";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Trophy,
  Settings,
  BarChart3,
  Activity,
  LayoutGrid,
  Shield,
  Users,
  ListOrdered,
  Plus,
  ChevronDown,
  MoreHorizontal,
  Menu,
  X,
  CheckCircle,
  Zap,
} from "lucide-react";
import { PageSkeleton } from "@/components/shared/skeleton";
import { SeasonSelector } from "@/components/competitions/season-selector";
import { useState, useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { useCompetitionOverviewStats, useSeasonHasFixtures } from "@/lib/hooks/use-competition-stats";
import { useGenerateFixtures } from "@/lib/hooks/use-competitions";
import { useToast } from "@/components/ui/toast";
import { formatRelativeTime } from "@/lib/utils/helpers";

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
  { href: "", label: "Overview", icon: LayoutGrid, group: "core" },
  { href: "fixtures", label: "Fixtures", icon: Calendar, group: "core" },
  { href: "results", label: "Results", icon: ListOrdered, group: "core" },
  { href: "standings", label: "Standings", icon: Trophy, group: "core", showFor: "league" },
  { href: "teams", label: "Teams", icon: Shield, group: "more" },
  { href: "players", label: "Players", icon: Users, group: "more" },
  { href: "stats", label: "Statistics", icon: BarChart3, group: "more" },
  { href: "live", label: "Live Event", icon: Activity, group: "more" },
  { href: "settings", label: "Settings", icon: Settings, group: "more" },
];

const coreTabs = tabs.filter((t) => t.group === "core");
const moreTabs = tabs.filter((t) => t.group === "more");

export default function CompetitionLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const slug = params.slug as string;
  const cId = params.cId as string;
  const { data: currentCompetition, isLoading } = useCompetition(cId);
  const { data: seasons = [] } = useSeasons(currentCompetition?.id);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const setCurrentSeasonId = useAppStore((s) => (s as any).setCurrentSeasonId);
  const [moreTabsOpen, setMoreTabsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const moreTabsRef = useRef<HTMLDivElement>(null);
  const { success: toastSuccess, error: toastError } = useToast();
  const generateFixtures = useGenerateFixtures();
  const hasFixtures = useSeasonHasFixtures(selectedSeasonId ?? undefined);

  const currentSeason = seasons.find((s) => s.is_current);
  const stats = useCompetitionOverviewStats(selectedSeasonId ?? undefined, currentCompetition?.id);

  useEffect(() => {
    if (!selectedSeasonId && currentSeason) {
      setSelectedSeasonId(currentSeason.id);
    }
  }, [currentSeason?.id]);

  useEffect(() => {
    if (selectedSeasonId && seasons.length > 0 && !seasons.some((s) => s.id === selectedSeasonId)) {
      setSelectedSeasonId(null);
    }
  }, [seasons, selectedSeasonId]);

  useEffect(() => {
    setCurrentSeasonId(selectedSeasonId);
  }, [selectedSeasonId]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (moreTabsRef.current && !moreTabsRef.current.contains(e.target as Node)) {
        setMoreTabsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (isLoading || !currentCompetition) {
    return (
      <div className="flex items-center justify-center py-20">
        <PageSkeleton />
      </div>
    );
  }

  const basePath = `/org/${slug}/competitions/${cId}`;
  const activeTab = pathname.replace(/\/$/, "");

  const handleGenerateFixtures = async () => {
    if (!selectedSeasonId) return;
    try {
      await generateFixtures.mutateAsync({ competitionId: cId, seasonId: selectedSeasonId });
      toastSuccess("Fixtures generated successfully!");
    } catch (error: any) {
      toastError(error.message || "Failed to generate fixtures");
    }
  };

  const handleQuickAction = (action: "fixture" | "result" | "generate") => {
    const base = `/org/${slug}/competitions/${cId}`;
    const seasonQ = selectedSeasonId ? `?seasonId=${selectedSeasonId}` : "";
    switch (action) {
      case "fixture":
        window.location.href = `${base}/fixtures/new${seasonQ}`;
        break;
      case "result":
        window.location.href = `${base}/results${seasonQ}`;
        break;
      case "generate":
        handleGenerateFixtures();
        break;
    }
  };

  if (isLoading || !currentCompetition) {
    return (
      <div className="flex items-center justify-center py-20">
        <PageSkeleton />
      </div>
    );
  }

  const seasonSelector = seasons.length > 0 && (
    <SeasonSelector
      seasons={seasons}
      selectedSeasonId={selectedSeasonId}
      onSeasonChange={setSelectedSeasonId}
    />
  );

  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId) || currentSeason;

  return (
    <div className="space-y-6">
      {/* Enhanced Header with Live Indicator */}
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
            {selectedSeason && (
              <span className="text-sm text-muted">{selectedSeason.name}</span>
            )}
            {stats.lastUpdated && (
              <span className="text-xs text-muted hidden sm:inline-flex items-center gap-1">
                Updated {formatRelativeTime(stats.lastUpdated)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation - Grouped with Dropdown */}
      <nav className="flex flex-wrap items-center gap-1 border-b border-line overflow-x-auto" role="tablist">
        {coreTabs
          .filter((t) => t.showFor === null || currentCompetition.type === t.showFor)
          .map((tab) => {
            const isActive =
              activeTab === `${basePath}/${tab.href}` ||
              (tab.href === "" && activeTab === basePath);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href || "overview"}
                href={`${basePath}/${tab.href}${selectedSeasonId ? `?seasonId=${selectedSeasonId}` : ""}`}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors shrink-0 ${
                  isActive
                    ? "border-brand text-brand bg-brand-50/30"
                    : "border-transparent text-muted hover:text-text hover:bg-surface-2/50"
                }`}
                role="tab"
                aria-selected={isActive}
              >
                <Icon size={16} />
                {tab.label}
              </Link>
            );
          })}

        {/* More Dropdown */}
        <div className="relative shrink-0" ref={moreTabsRef}>
          <button
            onClick={() => setMoreTabsOpen(!moreTabsOpen)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors shrink-0 ${
              moreTabsOpen
                ? "border-brand text-brand bg-brand-50/30"
                : "border-transparent text-muted hover:text-text hover:bg-surface-2/50"
            }`}
            aria-expanded={moreTabsOpen}
            aria-haspopup="menu"
          >
            <MoreHorizontal size={16} />
            <span>More</span>
            <ChevronDown size={12} className={moreTabsOpen ? "rotate-180" : ""} />
          </button>
          {moreTabsOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMoreTabsOpen(false)} aria-hidden="true" />
              <div
                role="menu"
                className="absolute right-0 top-full mt-1 bg-surface border border-line rounded-lg shadow-lg py-1 z-20 min-w-[180px] max-w-[calc(100vw-2rem)]"
              >
                {moreTabs
                  .filter((t) => t.showFor === null || currentCompetition.type === t.showFor)
                  .map((tab) => {
                    const isActive =
                      activeTab === `${basePath}/${tab.href}` ||
                      (tab.href === "" && activeTab === basePath);
                    const Icon = tab.icon;
                    return (
                      <Link
                        key={tab.href}
                        href={`${basePath}/${tab.href}${selectedSeasonId ? `?seasonId=${selectedSeasonId}` : ""}`}
                        role="menuitem"
                        className={`flex items-center gap-2 px-4 py-2 text-sm hover:bg-surface-2 transition-colors ${
                          isActive ? "font-semibold text-brand" : ""
                        }`}
                      >
                        <Icon size={16} />
                        {tab.label}
                      </Link>
                    );
                  })}
              </div>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden shrink-0 p-2 text-muted hover:text-text"
          aria-expanded={mobileMenuOpen}
          aria-label="Menu"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {/* Mobile Bottom Tab Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-line z-40 pb-safe">
        <div className="grid grid-cols-4">
          {coreTabs
            .filter((t) => t.showFor === null || currentCompetition.type === t.showFor)
            .map((tab) => {
              const isActive =
                activeTab === `${basePath}/${tab.href}` ||
                (tab.href === "" && activeTab === basePath);
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href || "overview"}
                  href={`${basePath}/${tab.href}${selectedSeasonId ? `?seasonId=${selectedSeasonId}` : ""}`}
                  className={`flex flex-col items-center gap-1 px-3 py-2 text-xs font-medium transition-colors ${
                    isActive ? "text-brand" : "text-muted"
                  }`}
                >
                  <Icon size={18} />
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          <button
            onClick={() => setMoreTabsOpen(!moreTabsOpen)}
            className={`flex flex-col items-center gap-1 px-3 py-2 text-xs font-medium transition-colors ${
              moreTabsOpen ? "text-brand" : "text-muted"
            }`}
          >
            <MoreHorizontal size={18} />
            <span>More</span>
          </button>
        </div>
        {moreTabsOpen && (
          <div className="lg:hidden fixed bottom-24 left-4 right-4 bg-surface border border-line rounded-lg shadow-lg p-2 z-50">
            {moreTabs
              .filter((t) => t.showFor === null || currentCompetition.type === t.showFor)
              .map((tab) => {
                const isActive =
                  activeTab === `${basePath}/${tab.href}` ||
                  (tab.href === "" && activeTab === basePath);
                const Icon = tab.icon;
                return (
                  <Link
                    key={tab.href}
                    href={`${basePath}/${tab.href}${selectedSeasonId ? `?seasonId=${selectedSeasonId}` : ""}`}
                    className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-2 transition-colors ${
                      isActive ? "font-semibold text-brand" : ""
                    }`}
                  >
                    <Icon size={16} />
                    {tab.label}
                  </Link>
                );
              })}
          </div>
        )}
      </div>

      {/* Quick Actions FAB / Fixed Bar */}
      <div className="fixed bottom-24 right-4 lg:bottom-8 z-30 flex flex-col-reverse gap-2" role="region" aria-label="Quick actions">
        {/* Generate Fixtures - only show if season has teams but no fixtures */}
        {!hasFixtures.data && selectedSeasonId && (
          <button
            onClick={() => handleQuickAction("generate")}
            disabled={generateFixtures.isPending}
            className="btn-primary px-4 py-2.5 shadow-lg flex items-center gap-2 hover:scale-105 transition-transform"
            aria-label="Generate fixtures"
          >
            <Zap size={16} />
            <span className="hidden sm:inline">Generate Fixtures</span>
          </button>
        )}
        {/* Add Fixture */}
        <button
          onClick={() => handleQuickAction("fixture")}
          className="floating-panel shadow-lg px-4 py-2.5 flex items-center gap-2 hover:scale-105 transition-transform"
          aria-label="Add fixture"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Add Fixture</span>
        </button>
        {/* Enter Results */}
        <button
          onClick={() => handleQuickAction("result")}
          className="floating-panel shadow-lg px-4 py-2.5 flex items-center gap-2 hover:scale-105 transition-transform"
          aria-label="Enter results"
        >
          <CheckCircle size={16} />
          <span className="hidden sm:inline">Enter Results</span>
        </button>
        {/* Mobile FAB */}
        <div className="lg:hidden fixed bottom-24 right-4 z-40">
          <button
            onClick={() => handleQuickAction("fixture")}
            className="btn-primary rounded-full w-14 h-14 shadow-lg flex items-center justify-center"
            aria-label="Quick actions"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      {children}
    </div>
  );
}