"use client";

import { useAppStore } from "@/lib/store";
import { allMatches, completedMatches } from "@/lib/logic/standings";

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
      { label: "Goals", value: teamGoalsScored, sub: "scored this season" },
      { label: "Players", value: teamPlayers.length, sub: "in squad" },
      { label: "Matches", value: teamMatches.length, sub: "this season" },
      { label: "Played", value: teamCompleted.length, sub: "completed" },
    ];

    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
