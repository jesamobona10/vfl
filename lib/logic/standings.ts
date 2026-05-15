import type { FixtureRound, Team, StandingRow, LeagueStats, Match } from "../types";
import { teamName } from "../utils/helpers";

export function allMatches(fixtures: FixtureRound[]): Match[] {
  return fixtures.flatMap((round) => round.matches);
}

export function completedMatches(fixtures: FixtureRound[]): Match[] {
  return allMatches(fixtures).filter(
    (match) =>
      match.status === "completed" &&
      Number.isInteger(match.homeScore) &&
      Number.isInteger(match.awayScore)
  );
}

export function roundByeId(round: FixtureRound, teams: Team[]): number | null {
  const activeTeams = new Set(
    round.matches.flatMap((match) => [match.homeId, match.awayId])
  );
  const missingTeams = teams.filter((team) => !activeTeams.has(team.id));
  return missingTeams.length === 1 ? missingTeams[0].id : round.byeId;
}

export function calculateStandings(
  teams: Team[],
  fixtures: FixtureRound[]
): StandingRow[] {
  const table: StandingRow[] = teams.map((team) => ({
    id: team.id,
    name: team.name,
    rating: team.rating || 6.0,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
    form: "",
  }));

  const tableById = new Map(table.map((team) => [team.id, team]));

  completedMatches(fixtures).forEach((match) => {
    const home = tableById.get(match.homeId);
    const away = tableById.get(match.awayId);
    if (!home || !away) return;
    home.played += 1;
    away.played += 1;
    home.gf += match.homeScore!;
    home.ga += match.awayScore!;
    away.gf += match.awayScore!;
    away.ga += match.homeScore!;

    if (match.homeScore! > match.awayScore!) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
    } else if (match.homeScore! < match.awayScore!) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }
  });

  table.forEach((team) => {
    team.gd = team.gf - team.ga;
  });

  return table.sort(
    (a, b) =>
      b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name)
  );
}

export function leagueStats(
  teams: Team[],
  fixtures: FixtureRound[]
): LeagueStats {
  const completed = completedMatches(fixtures);
  const goals = completed.reduce(
    (total, match) => total + match.homeScore! + match.awayScore!,
    0
  );
  const biggest = completed
    .map((match) => ({
      match,
      margin: Math.abs(match.homeScore! - match.awayScore!),
    }))
    .sort((a, b) => b.margin - a.margin)[0];

  const roundGoals = fixtures
    .map((round) => ({
      round: round.round,
      goals: round.matches
        .filter((match) => match.status === "completed")
        .reduce(
          (total, match) => total + match.homeScore! + match.awayScore!,
          0
        ),
    }))
    .sort((a, b) => b.goals - a.goals)[0];

  return {
    goals,
    goalsPerMatch: completed.length
      ? (goals / completed.length).toFixed(2)
      : "0.00",
    biggestWin:
      biggest && biggest.margin > 0
        ? `${teamName(
            biggest.match.homeScore! > biggest.match.awayScore!
              ? biggest.match.homeId
              : biggest.match.awayId,
            teams
          )} by ${biggest.margin}`
        : "None",
    highestRound:
      roundGoals && roundGoals.goals > 0
        ? `Round ${roundGoals.round} (${roundGoals.goals})`
        : "None",
  };
}
