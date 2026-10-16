/**
 * Winner/Champion resolution for leagues and cups.
 * Pure, deterministic, easy to test.
 */
import type { StandingRow } from "@/lib/types";

export interface Champion {
  teamId: number | null;
  name: string;
  competitionName: string;
  seasonName?: string;
  subtitle: string; // e.g. "Champions — Premier League" or "Cup Winners"
  detail: string;   // e.g. "12 pts · 4W 0D 2L · +8 GD"
  logoUrl?: string | null;
}

export interface ResolveLeagueInput {
  competitionName: string;
  seasonName?: string;
  standings: StandingRow[];
  fixturesCompleted: number;
  fixturesTotal: number;
}

export interface ResolveCupInput {
  competitionName: string;
  seasonName?: string;
  championTeamId: number | null;
  teams: Array<{
    id: number;
    name: string;
    logo_url?: string | null;
  }>;
}

export type ResolveWinnerInput = ResolveLeagueInput | ResolveCupInput;

export function resolveLeagueChampion({
  competitionName,
  seasonName,
  standings,
  fixturesCompleted,
  fixturesTotal,
}: ResolveLeagueInput): Champion | null {
  if (!fixturesTotal || fixturesCompleted < fixturesTotal) {
    return null;
  }
  const top = standings[0];
  if (!top) {
    return null;
  }
  const gd = top.gd >= 0 ? `+${top.gd}` : String(top.gd);
  return {
    teamId: top.id,
    name: top.name,
    competitionName,
    seasonName,
    subtitle: `${seasonName ? seasonName + " · " : ""}Champions`,
    detail: `${top.points} pts · ${top.won}W ${top.drawn}D ${top.lost}L · ${gd} GD`,
    logoUrl: null,
  };
}

export function resolveCupChampion({
  competitionName,
  seasonName,
  championTeamId,
  teams,
}: ResolveCupInput): Champion | null {
  if (championTeamId == null) {
    return null;
  }
  const team = teams.find((t) => t.id === championTeamId);
  if (!team) {
    return null;
  }
  return {
    teamId: team.id,
    name: team.name,
    competitionName,
    seasonName,
    subtitle: `${seasonName ? seasonName + " · " : ""}Cup Winners`,
    detail: "Knockout champions",
    logoUrl: team.logo_url ?? null,
  };
}

export function resolveChampion(input: ResolveWinnerInput): Champion | null {
  if ("championTeamId" in input) {
    return resolveCupChampion(input);
  }
  return resolveLeagueChampion(input);
}
