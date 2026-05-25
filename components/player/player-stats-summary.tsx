"use client";

import {
  Goal,
  Award,
  Shield,
  ShieldAlert,
  ShieldOff,
  HeartHandshake,
  Eye,
  Trophy,
} from "lucide-react";

interface PlayerStatsSummaryProps {
  player: {
    goals: number;
    assists: number;
    motm: number;
    cleanSheets: number;
    yellowCards: number;
    redCards: number;
    saves: number;
    matchWins: number;
    rating: number;
  };
}

export function PlayerStatsSummary({ player }: PlayerStatsSummaryProps) {
  const stats = [
    { icon: Goal, label: "Goals", value: player.goals, color: "text-brand" },
    { icon: HeartHandshake, label: "Assists", value: player.assists, color: "text-accent" },
    { icon: Trophy, label: "MOTM", value: player.motm, color: "text-accent" },
    { icon: Shield, label: "Clean Sheets", value: player.cleanSheets, color: "text-brand" },
    { icon: ShieldAlert, label: "Yellow", value: player.yellowCards, color: "text-accent" },
    { icon: ShieldOff, label: "Red", value: player.redCards, color: "text-danger" },
    { icon: Eye, label: "Saves", value: player.saves, color: "text-brand" },
    { icon: Award, label: "Wins", value: player.matchWins, color: "text-brand" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className={`${s.color} bg-surface-2 rounded-lg p-2`}>
              <Icon size={18} />
            </div>
            <div>
              <p className="text-lg font-bold">{s.value}</p>
              <p className="text-xs text-muted">{s.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
