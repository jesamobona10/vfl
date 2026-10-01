"use client";

import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useSeasonStatistics } from "@/lib/hooks/use-competitions";
import { Trophy, Target, EyeOff, AlertTriangle } from "lucide-react";
import { EmptyState, LoadingState } from "@/components/shared/skeleton";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";

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
    return <LoadingState label="Loading statistics" />;
  }

  if (!seasonId) {
    return (
      <EmptyState title="Select a season" description="Choose a season to view its statistics." />
    );
  }

  const currentList = statMap[activeTab] || [];

  const statLabel =
    activeTab === "goals"
      ? "Goals"
      : activeTab === "assists"
        ? "Assists"
        : activeTab === "yellow"
          ? "Yellow Cards"
          : "Red Cards";

  const statColumns: DataTableColumn<StatEntry>[] = [
    {
      key: "pos",
      header: "#",
      width: "3rem",
      className: "text-left text-muted",
      render: (_r, i) => i + 1,
    },
    {
      key: "player",
      header: "Player",
      className: "text-left font-medium",
      render: (entry) => <span className="truncate">{entry.name}</span>,
    },
    {
      key: "team",
      header: "Team",
      className: "text-left text-muted",
      render: (entry) => <span className="truncate">{entry.teamName}</span>,
    },
    {
      key: "count",
      header: statLabel,
      width: "7rem",
      className: "text-center font-bold",
      render: (entry) => <span className="text-lg">{entry.count}</span>,
    },
  ];

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
        <EmptyState
          title="No statistics yet"
          description="Statistics will appear after match events are recorded."
        />
      ) : (
        <DataTable
          rows={currentList}
          columns={statColumns}
          rowKey={(entry) => String(entry.playerId)}
          headClassName="text-muted font-medium normal-case tracking-normal"
          mobileCard={(entry, i) => (
            <div className="card px-3 py-2.5 flex items-center gap-3 text-sm">
              <span className="text-muted shrink-0 w-5">{i + 1}</span>
              <span className="flex items-center gap-2 min-w-0 flex-1">
                <span className="font-medium truncate">{entry.name}</span>
                <span className="text-muted text-xs truncate shrink-0 max-w-[40%]">
                  {entry.teamName}
                </span>
              </span>
              <span className="font-bold text-lg shrink-0 w-10 text-right">{entry.count}</span>
            </div>
          )}
        />
      )}
    </div>
  );
}
