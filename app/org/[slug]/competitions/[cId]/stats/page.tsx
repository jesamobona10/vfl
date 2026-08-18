"use client";

import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useSeasonStatistics } from "@/lib/hooks/use-competitions";
import { Trophy, Target, EyeOff, AlertTriangle } from "lucide-react";
import { PageSkeleton } from "@/components/shared/skeleton";

interface StatEntry {
  playerId: number;
  name: string;
  teamName: string;
  count: number;
}

const statTabs = [
  { key: "goals", label: "Goal Scorers", icon: Trophy },
  { key: "assists", label: "Assists", icon: Target },
  { key: "yellow", label: "Yellow Cards", icon: EyeOff },
  { key: "red", label: "Red Cards", icon: AlertTriangle },
];

export default function StatsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const seasonId = searchParams.get("seasonId");
  const { data: stats, isLoading } = useSeasonStatistics(seasonId || undefined);
  const [activeTab, setActiveTab] = useState("goals");

  const statMap = useMemo<Record<string, StatEntry[]>>(() => {
    const statsObj = stats as Record<string, unknown> | undefined;
    const rows = (statsObj?.player_stats ?? []) as Record<string, unknown>[];
    const byGoals = (r: Record<string, unknown>) => ({
      playerId: r.player_id as number,
      name: r.name as string,
      teamName: r.team_name as string,
      count: Number(r.goals || 0),
    });
    const byAssists = (r: Record<string, unknown>) => ({
      playerId: r.player_id as number,
      name: r.name as string,
      teamName: r.team_name as string,
      count: Number(r.assists || 0),
    });
    const byYellow = (r: Record<string, unknown>) => ({
      playerId: r.player_id as number,
      name: r.name as string,
      teamName: r.team_name as string,
      count: Number(r.yellow_cards || 0),
    });
    const byRed = (r: Record<string, unknown>) => ({
      playerId: r.player_id as number,
      name: r.name as string,
      teamName: r.team_name as string,
      count: Number(r.red_cards || 0),
    });
    const sort = (a: StatEntry, b: StatEntry) => b.count - a.count;
    return {
      goals: rows.map(byGoals).sort(sort),
      assists: rows.map(byAssists).sort(sort),
      yellow: rows.map(byYellow).sort(sort),
      red: rows.map(byRed).sort(sort),
    };
  }, [stats]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <PageSkeleton />
      </div>
    );
  }

  if (!seasonId) {
    return (
      <div className="card p-8 text-center text-muted">Select a season to view its statistics.</div>
    );
  }

  const currentList = statMap[activeTab] || [];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-line overflow-x-auto">
        {statTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors shrink-0 ${
                isActive
                  ? "border-brand text-brand"
                  : "border-transparent text-muted hover:text-text"
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {currentList.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted">No statistics yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left px-3 py-2 text-muted font-medium">#</th>
                <th className="text-left px-3 py-2 text-muted font-medium">Player</th>
                <th className="text-left px-3 py-2 text-muted font-medium">Team</th>
                <th className="text-center px-3 py-2 text-muted font-medium">
                  {activeTab === "goals"
                    ? "Goals"
                    : activeTab === "assists"
                      ? "Assists"
                      : activeTab === "yellow"
                        ? "Yellow Cards"
                        : "Red Cards"}
                </th>
              </tr>
            </thead>
            <tbody>
              {currentList.map((entry, i) => (
                <tr
                  key={entry.playerId}
                  className="border-b border-line/50 hover:bg-surface-2/30 transition-colors"
                >
                  <td className="px-3 py-2.5 text-muted w-8">{i + 1}</td>
                  <td className="px-3 py-2.5 font-medium">{entry.name}</td>
                  <td className="px-3 py-2.5 text-muted">{entry.teamName}</td>
                  <td className="px-3 py-2.5 text-center font-bold text-lg">{entry.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
