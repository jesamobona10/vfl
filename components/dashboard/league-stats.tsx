"use client";

import { useAppStore } from "@/lib/store";
import { leagueStats } from "@/lib/logic/standings";
import {
  Goal,
  Crosshair,
  Trophy,
  Layers,
} from "lucide-react";

export function LeagueStats() {
  const teams = useAppStore((s) => s.teams);
  const fixtures = useAppStore((s) => s.fixtures);

  const stats = leagueStats(teams, fixtures);

  const items = [
    { label: "Goals Scored", value: stats.goals, icon: Goal },
    {
      label: "Goals Per Match",
      value: stats.goalsPerMatch,
      icon: Crosshair,
    },
    {
      label: "Biggest Win",
      value: stats.biggestWin,
      icon: Trophy,
    },
    {
      label: "Highest Round",
      value: stats.highestRound,
      icon: Layers,
    },
  ];

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-muted mb-4 uppercase tracking-wider">
        Season Statistics
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label}>
              <div className="flex items-center gap-2 text-muted mb-1">
                <Icon size={14} />
                <span className="text-xs">{item.label}</span>
              </div>
              <p className="text-lg font-bold truncate">
                {item.value}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
