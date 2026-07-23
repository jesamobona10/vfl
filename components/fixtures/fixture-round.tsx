"use client";

import type { FixtureRound, Team } from "@/lib/types";
import { roundByeId } from "@/lib/logic/standings";
import { FixtureCard } from "./fixture-card";
import { useAppStore } from "@/lib/store";

interface FixtureRoundPanelProps {
  round: FixtureRound;
  teamFilter: string;
  statusFilter: string;
  editable?: boolean;
  onDrop: (matchId: number, targetId: number) => void;
}

export function FixtureRoundPanel({
  round,
  teamFilter,
  statusFilter,
  editable,
  onDrop,
}: FixtureRoundPanelProps) {
  const teams = useAppStore((s) => s.teams);
  const teamName = useAppStore((s) => s.teamName);
  const getTeam = useAppStore((s) => s.getTeam);

  const byeId = roundByeId(round, teams);
  const byeVisible =
    teamFilter === "all" || byeId === Number(teamFilter);
  const byeTeam = byeId ? getTeam(byeId) : null;

  const matchingMatches = round.matches.filter((match) => {
    const teamMatches =
      teamFilter === "all" ||
      match.homeId === Number(teamFilter) ||
      match.awayId === Number(teamFilter);
    const statusMatches =
      statusFilter === "all" || match.status === statusFilter;
    return teamMatches && statusMatches;
  });

  if (!matchingMatches.length && !byeVisible) return null;

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-surface-2 border-b border-line">
        <strong className="text-sm">Round {round.round}</strong>
        {byeTeam && (
          <span className="text-xs text-muted bg-surface rounded-full px-2.5 py-0.5">
            Bye: {byeTeam.name}
          </span>
        )}
      </div>
      <div className="p-3 space-y-2">
        {matchingMatches.map((match) => (
          <FixtureCard
            key={match.id}
            match={match}
            label={`Match ${match.id}`}
            homeTeam={getTeam(match.homeId)}
            awayTeam={getTeam(match.awayId)}
            editable={editable}
            onDrop={onDrop}
          />
        ))}
        {byeVisible && !matchingMatches.length && (
          <p className="text-sm text-muted text-center py-4">
            {byeTeam?.name} has a bye this round.
          </p>
        )}
      </div>
    </section>
  );
}
