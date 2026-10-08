"use client";

import type { FixtureRound, Team } from "@/lib/types";
import { roundByeId } from "@/lib/logic/standings";
import { FixtureCard } from "./fixture-card";
import { useAppStore } from "@/lib/store";
import { useResolvedTeams } from "@/lib/hooks/use-resolved-teams";

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
  const currentSeasonId = useAppStore((s) => s.currentSeasonId);
  const seasonId = round.matches[0]?.season_id ?? currentSeasonId;
  const teams = useResolvedTeams(seasonId);
  const getTeam = useAppStore((s) => s.getTeam);
  const resolveTeam = (teamId: number) => teams.find((team) => team.id === teamId) ?? getTeam(teamId);

  const byeId = roundByeId(round, teams);
  const byeVisible = teamFilter === "all" || byeId === Number(teamFilter);
  const byeTeam = byeId ? resolveTeam(byeId) : null;

  const matchingMatches = round.matches.filter((match) => {
    const teamMatches =
      teamFilter === "all" ||
      match.homeId === Number(teamFilter) ||
      match.awayId === Number(teamFilter);
    const statusMatches = statusFilter === "all" || match.status === statusFilter;
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
      <div className="p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {matchingMatches.map((match) => (
          <FixtureCard
            key={match.id}
            match={match}
            label={`Match ${match.id}`}
            homeTeam={resolveTeam(match.homeId)}
            awayTeam={resolveTeam(match.awayId)}
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
