import type { Player, Team, Match } from "../types";

export type TrackingLevel = "essential" | "standard" | "detailed";

export interface MatchPlayerRatingInput {
  player: Player;
  position: Player["position"];
  minutes?: number;
  coachRating?: number | null;
  trackingLevel?: TrackingLevel;
}

const ESSENTIAL_METRICS: Record<string, string[]> = {
  GK: ["minutes", "cleanSheets", "goalsConceded", "saves", "penaltySaves", "matchWins", "motm", "errorsLeadingToGoal", "redCards", "yellowCards", "ownGoals"],
  DEF: ["minutes", "cleanSheets", "goalsConceded", "tackles", "interceptions", "blocks", "aerialDuelsWon", "assists", "goals", "matchWins", "motm", "errorsLeadingToGoal", "redCards", "yellowCards", "ownGoals", "penaltiesConceded"],
  MID: ["minutes", "goals", "assists", "tackles", "interceptions", "matchWins", "motm", "errorsLeadingToGoal", "redCards", "yellowCards", "ownGoals"],
  ATT: ["minutes", "goals", "assists", "matchWins", "motm", "errorsLeadingToGoal", "redCards", "yellowCards", "ownGoals"],
};

const LEVEL_METRICS: Record<TrackingLevel, Record<string, string[]>> = {
  essential: ESSENTIAL_METRICS,
  standard: {
    GK: [...ESSENTIAL_METRICS.GK, "penaltySaves"],
    DEF: [...ESSENTIAL_METRICS.DEF],
    MID: [...ESSENTIAL_METRICS.MID],
    ATT: [...ESSENTIAL_METRICS.ATT],
  },
  detailed: {
    GK: [...ESSENTIAL_METRICS.GK],
    DEF: [...ESSENTIAL_METRICS.DEF],
    MID: [...ESSENTIAL_METRICS.MID],
    ATT: [...ESSENTIAL_METRICS.ATT],
  },
};

const POSITION_WEIGHTS: Record<string, Record<string, number>> = {
  GK: {
    minutes: 0,
    cleanSheets: 2.0,
    penaltySaves: 3.0,
    saves: 0.2,
    bonus5Saves: 1.5,
    matchWins: 1.0,
    motm: 2.0,
    goalsConceded: -0.3,
    errorsLeadingToGoal: -2.0,
    redCards: -3.0,
    yellowCards: -1.0,
    ownGoals: -2.0,
  },
  DEF: {
    minutes: 0,
    cleanSheets: 2.0,
    tackles: 0.3,
    interceptions: 0.2,
    blocks: 0.3,
    aerialDuelsWon: 0.2,
    assists: 2.0,
    goals: 3.0,
    matchWins: 1.0,
    motm: 2.0,
    errorsLeadingToGoal: -2.0,
    goalsConceded: -0.2,
    yellowCards: -1.0,
    redCards: -3.0,
    ownGoals: -2.5,
    penaltiesConceded: -2.0,
  },
  MID: {
    minutes: 0,
    goals: 2.0,
    assists: 2.0,
    tackles: 0.2,
    interceptions: 0.15,
    matchWins: 1.0,
    motm: 2.0,
    yellowCards: -0.5,
    redCards: -2.0,
    ownGoals: -1.5,
    errorsLeadingToGoal: -1.5,
  },
  ATT: {
    minutes: 0,
    goals: 3.0,
    assists: 2.0,
    matchWins: 1.0,
    motm: 2.0,
    yellowCards: -0.5,
    redCards: -2.0,
    ownGoals: -2.0,
    errorsLeadingToGoal: -1.5,
  },
};

function isMetricLogged(player: Player, metric: string): boolean {
  if (metric === "minutes") return true;
  const value = (player as any)[metric];
  if (typeof value === "number") {
    return value !== 0 || metric === "goals" || metric === "assists" || metric === "matchWins" || metric === "motm" || metric === "cleanSheets" || metric === "saves" || metric === "tackles" || metric === "interceptions" || metric === "blocks" || metric === "aerialDuelsWon";
  }
  return false;
}

export function calculateMatchRating(input: MatchPlayerRatingInput): { rating: number; coverage: number; logged: number; applicable: number } {
  const { player, position, minutes = 0, coachRating, trackingLevel = "essential" } = input;
  const applicable = LEVEL_METRICS[trackingLevel][position] || ESSENTIAL_METRICS[position] || [];
  if (minutes === 0 && !coachRating) {
    return { rating: 6.0, coverage: 0, logged: 0, applicable: applicable.length };
  }

  if (coachRating != null && (applicable.length === 0 || applicable.filter((m) => m !== "minutes").every((m) => !isMetricLogged(player, m) && (player as any)[m] === 0))) {
    const rating = Math.max(1.0, Math.min(10.0, Number(coachRating)));
    return { rating, coverage: 0, logged: 0, applicable: applicable.length };
  }

  let score = 6.0;
  const weights = POSITION_WEIGHTS[position] || {};
  let totalWeight = 0;
  let loggedWeight = 0;
  let loggedCount = 0;

  for (const metric of applicable) {
    if (metric === "minutes") continue;
    const w = Math.abs(weights[metric] || 0);
    if (w === 0) continue;
    totalWeight += w;
    if (isMetricLogged(player, metric)) {
      loggedWeight += w;
      loggedCount += 1;
      const val = Number((player as any)[metric]) || 0;
      score += (weights[metric] || 0) * val;
    }
  }

  if (totalWeight > 0 && loggedWeight > 0) {
    score = 6.0 + (score - 6.0) * (loggedWeight / totalWeight);
  } else if (totalWeight > 0 && loggedWeight === 0) {
    score = 6.0;
  }

  if (coachRating != null) {
    const coach = Math.max(1.0, Math.min(10.0, Number(coachRating)));
    score = score * 0.6 + coach * 0.4;
  }

  const coverage = totalWeight > 0 ? loggedWeight / totalWeight : 0;
  return { rating: Math.max(1.0, Math.min(10.0, score)), coverage, logged: loggedCount, applicable: applicable.filter((m) => m !== "minutes").length };
}

export function updatePlayerRatings(players: Player[], trackingLevel: TrackingLevel = "essential"): void {
  players.forEach((player) => {
    const result = calculateMatchRating({ player, position: player.position, minutes: 90, trackingLevel });
    player.rating = Math.max(1.0, Math.min(10.0, result.rating));
  });
}

export function updateTeamRatings(teams: Team[], allMatches: Match[], players: Player[]): void {
  const completed = allMatches.filter((m) => m.status === "completed");
  teams.forEach((team) => {
    const teamMatches = completed.filter((m) => m.homeId === team.id || m.awayId === team.id);
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
      : 6.0;

    team.rating = Math.max(1.0, Math.min(10.0, 6.0 + totalChange + (avgPlayerRating - 6.0) * 0.1));
  });
}
