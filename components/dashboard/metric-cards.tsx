"use client";

import { useAppStore } from "@/lib/store";
import { useResolvedTeams } from "@/lib/hooks/use-resolved-teams";
import { allMatches, completedMatches } from "@/lib/logic/standings";
import Image from "next/image";
import Link from "next/link";

type TeamLite = { id: number; name: string; logo_url?: string };

function TeamCrest({ team }: { team: TeamLite | undefined }) {
  if (!team) return null;
  return team.logo_url ? (
    <Image
      src={team.logo_url}
      alt=""
      width={48}
      height={48}
      className="w-12 h-12 rounded-full object-cover shrink-0"
    />
  ) : (
    <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center text-lg font-bold text-muted shrink-0">
      {team.name?.[0] || "?"}
    </div>
  );
}

function kickoffLabel(date: string, time?: string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date || "Date TBD";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfDay.getTime() - startOfToday.getTime()) / 86_400_000);
  const dayLabel =
    diffDays === 0
      ? "Today"
      : diffDays === 1
        ? "Tomorrow"
        : diffDays > 1 && diffDays <= 7
          ? `In ${diffDays} days`
          : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return time ? `${dayLabel} · ${time}` : dayLabel;
}

function FeaturedFixture({
  match,
  teams,
  href,
}: {
  match: {
    id: number;
    round: number;
    homeId: number;
    awayId: number;
    date: string;
    time: string;
  } | undefined;
  teams: TeamLite[];
  href?: string;
}) {
  if (!match) {
    return (
      <div className="col-span-2 md:row-span-2 card p-5 flex flex-col">
        <span className="metric-label">Next Fixture</span>
        <div className="flex-1 flex items-center justify-center text-center text-sm text-muted px-4 py-8">
          No scheduled matches ahead.
        </div>
      </div>
    );
  }
  const home = teams.find((t) => t.id === match.homeId);
  const away = teams.find((t) => t.id === match.awayId);

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="metric-label uppercase tracking-wider">Next Fixture</span>
        <span className="dot-scheduled shrink-0">Round {match.round}</span>
      </div>

      <div className="flex-1 flex items-center justify-between gap-3 py-5">
        <div className="flex flex-col items-center gap-2 min-w-0 flex-1">
          <TeamCrest team={home} />
          <span className="text-sm font-semibold truncate max-w-full text-center">
            {home?.name || "Unknown"}
          </span>
        </div>

        <div className="text-center shrink-0 px-1">
          <div className="text-xl font-bold tracking-tight">VS</div>
        </div>

        <div className="flex flex-col items-center gap-2 min-w-0 flex-1">
          <TeamCrest team={away} />
          <span className="text-sm font-semibold truncate max-w-full text-center">
            {away?.name || "Unknown"}
          </span>
        </div>
      </div>

      <p className="text-[13px] text-ink-2 font-medium">{kickoffLabel(match.date, match.time)}</p>
    </>
  );

  if (!href) {
    return <div className="card p-5 flex flex-col col-span-2 md:row-span-2">{body}</div>;
  }

  return (
    <Link href={href} className="card-hover card p-5 flex flex-col col-span-2 md:row-span-2 focus:outline-none">
      {body}
    </Link>
  );
}

export function MetricCards({ fixtureHref }: { fixtureHref?: string }) {
  const currentSeasonId = useAppStore((s) => s.currentSeasonId);
  const teams = useResolvedTeams(currentSeasonId);
  const players = useAppStore((s) => s.players);
  const fixtures = useAppStore((s) => s.fixtures);
  const isTeamAccount = useAppStore((s) => s.isTeamAccount);
  const managedId = useAppStore((s) => s.getManagedTeamId)();

  const totalMatches = allMatches(fixtures).length;
  const completed = completedMatches(fixtures).length;

  const nextFixture = [...allMatches(fixtures)]
    .filter((m) => m.status === "scheduled" && m.homeId && m.awayId)
    .sort((a, b) => {
      const da = `${a.date} ${a.time ?? ""}`.trim();
      const db = `${b.date} ${b.time ?? ""}`.trim();
      return da.localeCompare(db);
    })[0];

  const teamMatches = allMatches(fixtures).filter(
    (m) => m.homeId === managedId || m.awayId === managedId
  );
  const teamCompleted = teamMatches.filter(
    (m) =>
      m.status === "completed" && Number.isInteger(m.homeScore) && Number.isInteger(m.awayScore)
  );

  const teamPlayers = players.filter((p) => p.teamId === managedId);

  const teamGoalsScored = teamCompleted.reduce((total, m) => {
    if (m.homeId === managedId) return total + (m.homeScore ?? 0);
    return total + (m.awayScore ?? 0);
  }, 0);

  if (isTeamAccount()) {
    const cards = [
      { label: "Goals", value: teamGoalsScored, sub: "scored this season" },
      { label: "Players", value: teamPlayers.length, sub: "in squad" },
      { label: "Matches", value: teamMatches.length, sub: "this season" },
      { label: "Played", value: teamCompleted.length, sub: "completed" },
    ];

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <FeaturedFixture
          match={nextFixture}
          teams={teams as unknown as TeamLite[]}
          href={fixtureHref}
        />
        {cards.map((card) => (
          <div key={card.label} className="metric-card">
            <div className="metric-label">{card.label}</div>
            <div className="metric-value">{card.value}</div>
            <div className="metric-sub">{card.sub}</div>
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    { label: "Teams", value: teams.length, sub: "registered teams" },
    { label: "Players", value: players.length, sub: "registered players" },
    { label: "Matches", value: totalMatches, sub: "across all competitions" },
    { label: "Completed", value: completed, sub: "played fixtures" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <FeaturedFixture
        match={nextFixture}
        teams={teams as unknown as TeamLite[]}
        href={fixtureHref}
      />
      {cards.map((card) => (
        <div key={card.label} className="metric-card">
          <div className="metric-label">{card.label}</div>
          <div className="metric-value">{card.value}</div>
          <div className="metric-sub">{card.sub}</div>
        </div>
      ))}
    </div>
  );
}
