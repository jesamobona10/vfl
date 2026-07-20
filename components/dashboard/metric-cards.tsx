"use client";

import { useAppStore } from "@/lib/store";
import { allMatches, completedMatches } from "@/lib/logic/standings";
import {
  Users,
  UserCog,
  Calendar,
  Trophy,
  Goal,
} from "lucide-react";

export function MetricCards() {
  const teams = useAppStore((s) => s.teams);
  const players = useAppStore((s) => s.players);
  const fixtures = useAppStore((s) => s.fixtures);
  const isTeamAccount = useAppStore((s) => s.isTeamAccount);
  const managedId = useAppStore((s) => s.getManagedTeamId)();

  const totalMatches = allMatches(fixtures).length;
  const completed = completedMatches(fixtures).length;

  const teamMatches = allMatches(fixtures).filter(
    (m) => m.homeId === managedId || m.awayId === managedId
  );
  const teamCompleted = teamMatches.filter(
    (m) =>
      m.status === "completed" &&
      Number.isInteger(m.homeScore) &&
      Number.isInteger(m.awayScore)
  );

  const teamPlayers = players.filter((p) => p.teamId === managedId);

  const teamGoalsScored = teamCompleted.reduce((total, m) => {
    if (m.homeId === managedId) return total + (m.homeScore ?? 0);
    return total + (m.awayScore ?? 0);
  }, 0);

  if (isTeamAccount()) {
    const cards = [
      {
        label: "Goals",
        value: teamGoalsScored,
        icon: Goal,
        color: "text-brand",
      },
      {
        label: "Players",
        value: teamPlayers.length,
        icon: UserCog,
        color: "text-accent",
      },
      {
        label: "Matches",
        value: teamMatches.length,
        icon: Calendar,
        color: "text-blue-500",
      },
      {
        label: "Played",
        value: teamCompleted.length,
        icon: Trophy,
        color: "text-green-500",
      },
    ];

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">{card.label}</p>
                  <p className="text-3xl font-bold mt-1">
                    {card.value}
                  </p>
                </div>
                <Icon className={card.color} size={32} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const cards = [
    {
      label: "Teams",
      value: teams.length,
      icon: Users,
      color: "text-brand",
    },
    {
      label: "Players",
      value: players.length,
      icon: UserCog,
      color: "text-accent",
    },
    {
      label: "Matches",
      value: totalMatches,
      icon: Calendar,
      color: "text-blue-500",
    },
    {
      label: "Completed",
      value: completed,
      icon: Trophy,
      color: "text-green-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">{card.label}</p>
                <p className="text-3xl font-bold mt-1">
                  {card.value}
                </p>
              </div>
              <Icon className={card.color} size={32} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
