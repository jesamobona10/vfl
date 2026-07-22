"use client";

import { useCompetition, useSeasons } from "@/lib/hooks/use-competitions";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Calendar, Trophy, Settings } from "lucide-react";
import { PageSkeleton } from "@/components/shared/skeleton";
import { SeasonSelector } from "@/components/competitions/season-selector";
import { useState, useEffect } from "react";

const typeLabels: Record<string, string> = {
  league: "League",
  cup: "Cup",
  friendly: "Friendly",
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-500/20 text-gray-300",
  active: "bg-green-500/20 text-green-400",
  completed: "bg-blue-500/20 text-blue-400",
};

const tabs = [
  { href: "fixtures", label: "Fixtures", icon: Calendar, showFor: null },
  { href: "standings", label: "Standings", icon: Trophy, showFor: "league" },
  { href: "settings", label: "Settings", icon: Settings, showFor: null },
];

export default function CompetitionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const slug = params.slug as string;
  const cId = params.cId as string;
  const { data: currentCompetition, isLoading } = useCompetition(cId);
  const { data: seasons = [] } = useSeasons(currentCompetition?.id);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);

  const currentSeason = seasons.find((s) => s.is_current);
  useEffect(() => {
    if (!selectedSeasonId && currentSeason) {
      setSelectedSeasonId(currentSeason.id);
    }
  }, [currentSeason?.id]);

  if (isLoading || !currentCompetition) {
    return (
      <div className="flex items-center justify-center py-20">
        <PageSkeleton />
      </div>
    );
  }

  const basePath = `/org/${slug}/competitions/${cId}`;
  const activeTab = pathname.replace(/\/$/, "");

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        {currentCompetition.logo_url && (
          <img src={currentCompetition.logo_url} alt={currentCompetition.name} className="w-14 h-14 rounded-xl object-cover shrink-0" />
        )}
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="uppercase tracking-wider text-xs">
              {typeLabels[currentCompetition.type] ?? "Competition"}
            </span>
            <span
              className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                statusColors[currentCompetition.status] ?? statusColors.draft
              }`}
            >
              {currentCompetition.status}
            </span>
          </div>
          <h1 className="text-2xl font-bold truncate">{currentCompetition.name}</h1>
          <div className="flex items-center gap-3">
            {seasons.length > 0 && (
              <SeasonSelector
                seasons={seasons}
                selectedSeasonId={selectedSeasonId}
                onSeasonChange={setSelectedSeasonId}
              />
            )}
            {currentCompetition.season && (
              <span className="text-sm text-muted">{currentCompetition.season}</span>
            )}
          </div>
        </div>
      </div>

      <nav className="flex gap-1 border-b border-line overflow-x-auto">
        {tabs
          .filter((t) => t.showFor === null || currentCompetition.type === t.showFor)
          .map((tab) => {
            const isActive =
              activeTab === `${basePath}/${tab.href}` ||
              activeTab === basePath;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={`${basePath}/${tab.href}`}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors shrink-0 ${
                  isActive
                    ? "border-brand text-brand"
                    : "border-transparent text-muted hover:text-text"
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </Link>
            );
          })}
      </nav>

      {children}
    </div>
  );
}
