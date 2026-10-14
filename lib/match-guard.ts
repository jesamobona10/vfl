/**
 * Guard rules for starting a live match.
 *
 * The kickoff rule: a match cannot start until BOTH home and away teams have
 * at least one player registered (to the fixture's season). Kept as a pure
 * module so the decision logic can be unit-tested without a database.
 */

/** Registered-player counts keyed by team id. */
export type PlayerCounts = Partial<Record<number, number>>;

/** Names of the fixture's teams that have no registered players yet. */
export function teamsWithNoRegisteredPlayers(opts: {
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  counts: PlayerCounts;
}): string[] {
  const missing: string[] = [];
  if ((opts.counts[opts.homeTeamId] ?? 0) <= 0) missing.push(opts.homeTeamName);
  if ((opts.counts[opts.awayTeamId] ?? 0) <= 0) missing.push(opts.awayTeamName);
  return missing;
}

/**
 * Reason a match can't start yet, or `null` when both teams are eligible.
 * Returns the human-readable message the start endpoint should surface.
 */
export function registeredPlayersStartError(opts: {
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  counts: PlayerCounts;
}): string | null {
  const missing = teamsWithNoRegisteredPlayers(opts);
  if (missing.length === 0) return null;
  const names = missing.join(" and ");
  return `Match can't start — ${names} ${missing.length === 1 ? "has" : "have"} no registered players yet.`;
}