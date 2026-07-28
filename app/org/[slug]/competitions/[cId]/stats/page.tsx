"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Trophy, Target, EyeOff, AlertTriangle } from "lucide-react";
import { PageSkeleton } from "@/components/shared/skeleton";

interface StatEntry {
  playerId: number;
  name: string;
  teamId: number;
  teamName: string;
  count: number;
}

interface StatsData {
  goalScorers: StatEntry[];
  assists: StatEntry[];
  yellowCards: StatEntry[];
  redCards: StatEntry[];
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
  const cId = params.cId as string;
  const seasonId = searchParams.get("seasonId");
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("goals");

  useEffect(() => {
    setLoading(true);
    const url = `/api/competitions/${cId}/stats${seasonId ? `?season_id=${seasonId}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [cId, seasonId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <PageSkeleton />
      </div>
    );
  }

  const statMap: Record<string, StatEntry[]> = {
    goals: data?.goalScorers || [],
    assists: data?.assists || [],
    yellow: data?.yellowCards || [],
    red: data?.redCards || [],
  };

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
                  {activeTab === "goals" ? "Goals" : activeTab === "assists" ? "Assists" : activeTab === "yellow" ? "Yellow Cards" : "Red Cards"}
                </th>
              </tr>
            </thead>
            <tbody>
              {currentList.map((entry, i) => (
                <tr key={entry.playerId} className="border-b border-line/50 hover:bg-surface-2/30 transition-colors">
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
