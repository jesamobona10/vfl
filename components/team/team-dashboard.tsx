"use client";

import { useSearchParams } from "next/navigation";
import { Shield } from "lucide-react";
import { DashboardTabs } from "@/components/shared/dashboard-tabs";
import { MetricCards } from "@/components/dashboard/metric-cards";
import { UpcomingMatches } from "@/components/dashboard/upcoming-matches";
import { TopFiveStandings } from "@/components/dashboard/top-five-standings";
import { CompetitionsCard } from "@/components/dashboard/competitions-card";
import { CalendarView } from "@/components/calendar/calendar-view";
import { GeneratePlayerCredentials } from "@/components/players/generate-player-credentials";

interface TeamDashboardProps {
  team: {
    id: number;
    name: string;
    rating: number;
    logo_url?: string | null;
    logo?: string | null;
  };
  teamPlayerCount: number;
  competitions: Array<{ id: string; name: string; type: string; status: string }>;
}

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "players", label: "Players" },
  { key: "matches", label: "Matches" },
  { key: "standings", label: "Standings" },
];

export function TeamDashboard({ team, teamPlayerCount, competitions }: TeamDashboardProps) {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const current = tab && TABS.some((t) => t.key === tab) ? tab : "overview";

  return (
    <div className="space-y-5">
      <DashboardTabs tabs={TABS} defaultKey="overview" />

      {current === "overview" && (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-4">
            <div className="space-y-4">
              <div className="card p-5 flex items-center gap-4">
                {team.logo_url || team.logo ? (
                  <img
                    src={team.logo_url || team.logo!}
                    alt={team.name}
                    className="w-14 h-14 rounded-full object-cover"
                    width={56}
                    height={56}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-surface-2 flex items-center justify-center">
                    <Shield size={24} className="text-ink-2" />
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold">{team.name}</h2>
                  <p className="text-sm text-ink-2">Rating: {team.rating.toFixed(1)}</p>
                </div>
              </div>
              <MetricCards />
            </div>
            <TopFiveStandings />
          </div>
          <CompetitionsCard competitions={competitions} />
        </>
      )}

      {current === "players" && (
        <div className="card p-5">
          <GeneratePlayerCredentials
            scope="team"
            teamId={team.id}
            teamName={team.name}
            playerCount={teamPlayerCount}
          />
        </div>
      )}

      {current === "matches" && (
        <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-4">
          <UpcomingMatches />
          <CalendarView />
        </div>
      )}

      {current === "standings" && <TopFiveStandings />}
    </div>
  );
}
