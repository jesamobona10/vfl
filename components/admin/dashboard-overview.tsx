"use client";

import { useEffect, useState } from "react";
import { Building2, Users, UserCog, Calendar, Trophy, Swords, Loader2 } from "lucide-react";

interface Stats {
  organizations: number;
  teams: number;
  players: number;
  fixtures: number;
  competitions: number;
  cupMatches: number;
  orgMembers: number;
  teamAccounts: number;
  adminUsers: number;
}

export function DashboardOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((d) => setStats(d.stats))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-muted" /></div>;
  }

  if (!stats) return <p className="text-sm text-muted text-center py-8">Failed to load stats.</p>;

  const cards = [
    { label: "Organizations", value: stats.organizations, icon: Building2, color: "text-blue-400" },
    { label: "Teams", value: stats.teams, icon: Users, color: "text-green-400" },
    { label: "Players", value: stats.players, icon: UserCog, color: "text-purple-400" },
    { label: "Fixtures", value: stats.fixtures, icon: Calendar, color: "text-amber-400" },
    { label: "Competitions", value: stats.competitions, icon: Trophy, color: "text-pink-400" },
    { label: "Cup Matches", value: stats.cupMatches, icon: Swords, color: "text-cyan-400" },
    { label: "Org Members", value: stats.orgMembers, icon: Users, color: "text-orange-400" },
    { label: "Team Accounts", value: stats.teamAccounts, icon: Users, color: "text-indigo-400" },
    { label: "Admin Users", value: stats.adminUsers, icon: Users, color: "text-red-400" },
  ];

  return (
    <div>
      <h3 className="text-lg font-bold mb-4">Platform Overview</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon size={18} className={card.color} />
                <span className="text-xs text-muted uppercase tracking-wider">{card.label}</span>
              </div>
              <p className="text-2xl font-bold">{card.value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
