import type { Player, Team, Match } from "../types";

export function updatePlayerRatings(players: Player[]): void {
  players.forEach((player) => {
    let rating = 6.0;

    if (player.position === "GK") {
      rating += player.cleanSheets * 2.0;
      rating += player.penaltySaves * 3.0;
      rating += player.saves * 0.2;
      rating += player.bonus5Saves * 1.5;
      rating += player.matchWins * 1.0;
      rating += player.motm * 2.0;
      rating -= player.goalsConceded * 0.3;
      rating -= player.errorsLeadingToGoal * 2.0;
      rating -= player.redCards * 3.0;
      rating -= player.yellowCards * 1.0;
      rating -= player.ownGoals * 2.0;
    } else if (player.position === "DEF") {
      rating += player.cleanSheets * 2.0;
      rating += player.tackles * 0.3;
      rating += player.interceptions * 0.2;
      rating += player.blocks * 0.3;
      rating += player.aerialDuelsWon * 0.2;
      rating += player.assists * 2.0;
      rating += player.goals * 3.0;
      rating += player.matchWins * 1.0;
      rating += player.motm * 2.0;
      rating -= player.errorsLeadingToGoal * 2.0;
      rating -= player.goalsConceded * 0.2;
      rating -= player.yellowCards * 1.0;
      rating -= player.redCards * 3.0;
      rating -= player.ownGoals * 2.5;
      rating -= player.penaltiesConceded * 2.0;
    } else if (player.position === "MID") {
      rating += player.goals * 2.0;
      rating += player.assists * 2.0;
      rating += player.tackles * 0.2;
      rating += player.interceptions * 0.15;
      rating += player.matchWins * 1.0;
      rating += player.motm * 2.0;
      rating -= player.yellowCards * 0.5;
      rating -= player.redCards * 2.0;
      rating -= player.ownGoals * 1.5;
      rating -= player.errorsLeadingToGoal * 1.5;
    } else if (player.position === "ATT") {
      rating += player.goals * 3.0;
      rating += player.assists * 2.0;
      rating += player.matchWins * 1.0;
      rating += player.motm * 2.0;
      rating -= player.yellowCards * 0.5;
      rating -= player.redCards * 2.0;
      rating -= player.ownGoals * 2.0;
      rating -= player.errorsLeadingToGoal * 1.5;
    }

    player.rating = Math.max(1.0, Math.min(10.0, rating));
  });
}

export function updateTeamRatings(
  teams: Team[],
  allMatches: Match[],
  players: Player[]
): void {
  const completed = allMatches.filter((m) => m.status === "completed");
  teams.forEach((team) => {
    const teamMatches = completed.filter(
      (m) => m.homeId === team.id || m.awayId === team.id
    );
    if (!teamMatches.length) {
      team.rating = 6.0;
      return;
    }

    let totalChange = 0;
    teamMatches.forEach((match) => {
      const isHome = match.homeId === team.id;
      const teamScore = isHome ? match.homeScore : match.awayScore!;
      const oppScore = isHome ? match.awayScore : match.homeScore!;

      if (teamScore! > oppScore!) totalChange += 0.3;
      else if (teamScore! < oppScore!) totalChange -= 0.2;
      else totalChange += 0.1;
    });

    const teamPlayers = players.filter((p) => p.teamId === team.id);
    const avgPlayerRating = teamPlayers.length
      ? teamPlayers.reduce((sum, p) => sum + p.rating, 0) / teamPlayers.length
      : 1.0;

    team.rating = Math.max(
      6.0,
      Math.min(10.0, 6.0 + totalChange + (avgPlayerRating - 6.0) * 0.1)
    );
  });
}
