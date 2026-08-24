"use client";

import { useEffect, useState } from "react";
import { Building2, Users, UserCog, Calendar, Trophy, Swords } from "lucide-react";
import { DashboardSkeleton } from "@/components/shared/skeleton";
import { CalendarView } from "@/components/calendar/calendar-view";

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
    return <DashboardSkeleton />;
  }

  if (!stats) return <p className="text-sm text-muted text-center py-8">Failed to load stats.</p>;

  const cards = [
    { label: "Organizations", value: stats.organizations, icon: Building2, color: "text-brand" },
    { label: "Teams", value: stats.teams, icon: Users, color: "text-brand-600" },
    { label: "Players", value: stats.players, icon: UserCog, color: "text-gold-500" },
    { label: "Fixtures", value: stats.fixtures, icon: Calendar, color: "text-live-500" },
    { label: "Competitions", value: stats.competitions, icon: Trophy, color: "text-gold-700" },
    { label: "Cup Matches", value: stats.cupMatches, icon: Swords, color: "text-warn-500" },
    { label: "Org Members", value: stats.orgMembers, icon: Users, color: "text-ink-2" },
    { label: "Team Accounts", value: stats.teamAccounts, icon: Users, color: "text-ink-2" },
    { label: "Admin Users", value: stats.adminUsers, icon: Users, color: "text-danger-500" },
  ];

  return (
    <div>
      <h3 className="text-lg font-bold mb-4">Platform Overview</h3>
      <div className="grid gap-3 lg:grid-cols-[1.15fr_1fr] items-start">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="card p-4">
                <div className="flex items-center gap-2 mb-2 min-w-0">
                  <Icon size={18} className={`${card.color} shrink-0`} />
                  <span className="text-xs text-muted uppercase tracking-wider truncate">
                    {card.label}
                  </span>
                </div>
                <p className="text-2xl font-bold">{card.value}</p>
              </div>
            );
          })}
        </div>
        <div>
          <CalendarView />
        </div>
      </div>
    </div>
  );
}
