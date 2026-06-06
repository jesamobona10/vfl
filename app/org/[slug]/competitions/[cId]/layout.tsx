"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Calendar, Trophy, Swords, Settings, Loader2 } from "lucide-react";

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
  { href: "knockout", label: "Knockout", icon: Swords, showFor: null },
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
  const currentCompetition = useAppStore((s) => s.currentCompetition);
  const fetchCompetition = useAppStore((s) => s.fetchCompetition);

  useEffect(() => {
    if (cId) {
      fetchCompetition(cId);
    }
  }, [cId, fetchCompetition]);

  if (!currentCompetition) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-muted" />
      </div>
    );
  }

  const basePath = `/org/${slug}/competitions/${cId}`;
  const activeTab = pathname.replace(/\/$/, "");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
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
        <h1 className="text-2xl font-bold">{currentCompetition.name}</h1>
        {currentCompetition.season && (
          <p className="text-sm text-muted">Season: {currentCompetition.season}</p>
        )}
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
