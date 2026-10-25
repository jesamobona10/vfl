import type {
  PlayerOfRoundAward,
  PlayerPosition,
  RoundAwardPlayer,
  RoundAwardRound,
  TeamOfRoundSlot,
} from "@/lib/types";

/**
 * Team of the Round and Player of the Round selection.
 *
 * Everything here is pure: API routes feed in fixtures, events, lineups and
 * players, and get back a position-weighted 4-3-3 XI plus the round's best
 * player. Keeping the rules in one module makes the weights easy to tune and
 * gives the UI a single source of truth for the "how it's calculated" panel.
 */

export interface RoundFixtureInput {
  id: number;
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
}

export interface RoundEventInput {
  fixtureId: number;
  playerId: number | null;
  teamId: number | null;
  type: string;
}

export interface RoundPlayerInput {
  id: number;
  name: string;
  teamId: number;
  position: string | null;
  photoUrl?: string | null;
}

export interface RoundLineupInput {
  fixtureId: number;
  teamId: number;
  starterIds: number[];
}

export interface RoundTeamInput {
  id: number;
  name: string;
  logo: string | null;
}

export interface TeamOfRoundInput {
  fixtures: RoundFixtureInput[];
  events: RoundEventInput[];
  players: RoundPlayerInput[];
  lineups: RoundLineupInput[];
  teams: RoundTeamInput[];
}

export interface BuiltTeamOfRound {
  team: TeamOfRoundSlot[];
  playerOfRound: PlayerOfRoundAward | null;
  playerCount: number;
}

/** Formation used by the round awards: 4 defenders, 3 midfielders, 3 forwards. */
export const ROUND_FORMATION: ReadonlyArray<{ slot: PlayerPosition; count: number }> = [
  { slot: "GK", count: 1 },
  { slot: "DEF", count: 4 },
  { slot: "MID", count: 3 },
  { slot: "ATT", count: 3 },
];

const FORMATION_ORDER: Record<PlayerPosition, number> = {
  GK: 0,
  DEF: 1,
  MID: 2,
  ATT: 3,
};

const COMPLETED_STATUSES = new Set(["completed", "finished"]);
const PENDING_STATUSES = new Set(["scheduled", "upcoming", "live", "in-progress"]);

/** Normalise free-text positions into the four categories used by the app. */
export function normalizePosition(value: string | null | undefined): PlayerPosition {
  const raw = (value ?? "").trim().toUpperCase();
  if (!raw) return "MID";
  const compact = raw.replace(/[^A-Z]/g, "");
  const tokens = raw.split(/[^A-Z]+/).filter(Boolean);
  const matches = (values: string[]) =>
    values.includes(compact) || tokens.some((token) => values.includes(token));

  if (matches(["GK", "G", "GOALKEEPER", "KEEPER", "GL"])) return "GK";
  if (
    matches([
      "DEF",
      "DEFENDER",
      "DEFENCE",
      "DEFENSE",
      "DF",
      "CB",
      "LB",
      "RB",
      "LWB",
      "RWB",
      "BACK",
      "FULLBACK",
    ])
  ) {
    return "DEF";
  }
  if (
    matches([
      "MID",
      "MIDFIELDER",
      "MIDFIELD",
      "MF",
      "CM",
      "DM",
      "AM",
      "LM",
      "RM",
      "HOLDING",
      "PLAYMAKER",
    ])
  ) {
    return "MID";
  }
  if (
    matches([
      "ATT",
      "ATTACKER",
      "ATTACKING",
      "FW",
      "F",
      "FORWARD",
      "ST",
      "CF",
      "LW",
      "RW",
      "WINGER",
      "WING",
      "STRIKER",
    ])
  ) {
    return "ATT";
  }
  return "MID";
}

/** Normalise legacy and current event names to one canonical value. */
function normalizeEventType(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, "-");
}

/** True when a round has at least one result and nothing still in progress. */
export function isRoundComplete(statuses: string[]): boolean {
  const completed = statuses.filter((status) => COMPLETED_STATUSES.has(status)).length;
  const pending = statuses.filter((status) => PENDING_STATUSES.has(status)).length;
  return completed > 0 && pending === 0;
}

/** Group fixtures into ordered round summaries. */
export function summarizeRounds(
  fixtures: Array<{ round: number | null; status: string }>
): RoundAwardRound[] {
  const byRound = new Map<number, { matches: number; completed: number; statuses: string[] }>();

  for (const fixture of fixtures) {
    const round = fixture.round ?? 0;
    const entry = byRound.get(round) ?? { matches: 0, completed: 0, statuses: [] };
    entry.matches += 1;
    entry.statuses.push(fixture.status);
    if (COMPLETED_STATUSES.has(fixture.status)) entry.completed += 1;
    byRound.set(round, entry);
  }

  return [...byRound.entries()]
    .map(([round, entry]) => ({
      round,
      matches: entry.matches,
      completedMatches: entry.completed,
      complete: isRoundComplete(entry.statuses),
    }))
    .sort((a, b) => a.round - b.round);
}

function blankStats(player: RoundPlayerInput, team: RoundTeamInput | undefined): RoundAwardPlayer {
  return {
    playerId: player.id,
    name: player.name,
    teamId: player.teamId,
    teamName: team?.name ?? "Unknown team",
    teamLogo: team?.logo ?? null,
    photoUrl: player.photoUrl ?? null,
    position: normalizePosition(player.position),
    impact: 0,
    appearances: 0,
    goals: 0,
    assists: 0,
    ownGoals: 0,
    saves: 0,
    penaltySaves: 0,
    fivePlusSaves: false,
    cleanSheets: 0,
    goalsConceded: 0,
    tackles: 0,
    interceptions: 0,
    blocks: 0,
    aerialsWon: 0,
    errors: 0,
    penaltiesConceded: 0,
    yellowCards: 0,
    redCards: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    motm: 0,
  };
}

function applyEvent(stats: RoundAwardPlayer, rawType: string): void {
  switch (normalizeEventType(rawType)) {
    case "goal":
    case "penalty-goal":
      stats.goals += 1;
      break;
    case "assist":
      stats.assists += 1;
      break;
    case "own-goal":
      stats.ownGoals += 1;
      break;
    case "yellow":
    case "yellow-card":
      stats.yellowCards += 1;
      break;
    case "red":
    case "red-card":
      stats.redCards += 1;
      break;
    case "save":
      stats.saves += 1;
      break;
    case "penalty-save":
      stats.penaltySaves += 1;
      break;
    case "tackle":
      stats.tackles += 1;
      break;
    case "interception":
      stats.interceptions += 1;
      break;
    case "block":
      stats.blocks += 1;
      break;
    case "aerial":
      stats.aerialsWon += 1;
      break;
    case "error":
      stats.errors += 1;
      break;
    case "penalty-conceded":
      stats.penaltiesConceded += 1;
      break;
    case "motm":
      stats.motm += 1;
      break;
    default:
      // clean-sheet, goal-conceded, match-win and bonus-5-saves are derived
      // from fixture results and save counts, so the raw events are ignored.
      break;
  }
}

/**
 * Aggregate every player who appeared in the completed fixtures of a round.
 * Appearance = named in a starting XI or credited with at least one event.
 */
export function computeRoundPlayerStats(input: TeamOfRoundInput): RoundAwardPlayer[] {
  const teamById = new Map(input.teams.map((team) => [team.id, team]));
  const playerById = new Map(input.players.map((player) => [player.id, player]));
  const completed = input.fixtures.filter((fixture) => COMPLETED_STATUSES.has(fixture.status));
  const completedIds = new Set(completed.map((fixture) => fixture.id));

  const participantsByFixture = new Map<number, Set<number>>();
  const addParticipant = (fixtureId: number, playerId: number) => {
    if (!completedIds.has(fixtureId) || !playerById.has(playerId)) return;
    const set = participantsByFixture.get(fixtureId) ?? new Set<number>();
    set.add(playerId);
    participantsByFixture.set(fixtureId, set);
  };

  for (const lineup of input.lineups) {
    for (const playerId of lineup.starterIds) addParticipant(lineup.fixtureId, playerId);
  }
  for (const event of input.events) {
    if (event.playerId != null) addParticipant(event.fixtureId, event.playerId);
  }

  const statsByPlayer = new Map<number, RoundAwardPlayer>();
  const ensureStats = (playerId: number): RoundAwardPlayer | null => {
    const player = playerById.get(playerId);
    if (!player) return null;
    const existing = statsByPlayer.get(playerId);
    if (existing) return existing;
    const created = blankStats(player, teamById.get(player.teamId));
    statsByPlayer.set(playerId, created);
    return created;
  };

  // Create a row for every participant so lineup-only appearances count.
  for (const playerIds of participantsByFixture.values()) {
    for (const playerId of playerIds) ensureStats(playerId);
  }

  // Result, goals-conceded and clean-sheet credit come from the final score.
  for (const fixture of completed) {
    const participants = participantsByFixture.get(fixture.id);
    if (!participants) continue;

    const homeScore = fixture.homeScore ?? 0;
    const awayScore = fixture.awayScore ?? 0;
    const sides = [
      { teamId: fixture.homeTeamId, scored: homeScore, conceded: awayScore },
      { teamId: fixture.awayTeamId, scored: awayScore, conceded: homeScore },
    ];

    for (const side of sides) {
      for (const playerId of participants) {
        const player = playerById.get(playerId);
        if (!player || player.teamId !== side.teamId) continue;
        const stats = ensureStats(playerId);
        if (!stats) continue;

        stats.appearances += 1;
        stats.goalsConceded += side.conceded;
        if (side.scored > side.conceded) stats.wins += 1;
        else if (side.scored === side.conceded) stats.draws += 1;
        else stats.losses += 1;

        if (side.conceded === 0 && (stats.position === "GK" || stats.position === "DEF")) {
          stats.cleanSheets += 1;
        }
      }
    }
  }

  for (const event of input.events) {
    if (event.playerId == null || !completedIds.has(event.fixtureId)) continue;
    const stats = ensureStats(event.playerId);
    if (stats) applyEvent(stats, event.type);
  }

  const players = [...statsByPlayer.values()];
  for (const stats of players) {
    stats.fivePlusSaves = stats.saves >= 5;
    stats.impact = roundToTwo(scoreRoundPlayer(stats));
  }

  return players.sort(comparePlayers);
}

/** Position-specific impact score. Weights are intentionally easy to tune. */
export function scoreRoundPlayer(stats: RoundAwardPlayer): number {
  const common =
    stats.wins * 1.5 -
    stats.yellowCards * 0.5 -
    stats.redCards * 3.5 -
    stats.ownGoals * 3 +
    stats.motm * 2;

  if (stats.position === "GK") {
    return (
      stats.cleanSheets * 6 +
      stats.saves * 1.2 +
      stats.penaltySaves * 5 +
      (stats.fivePlusSaves ? 3 : 0) -
      stats.goalsConceded * 1.5 -
      stats.errors * 4 -
      stats.penaltiesConceded * 3 +
      stats.wins * 2 +
      stats.draws * 0.5 -
      stats.yellowCards * 1 -
      stats.redCards * 4 -
      stats.ownGoals * 4 +
      stats.motm * 2
    );
  }

  if (stats.position === "DEF") {
    return (
      stats.cleanSheets * 4 +
      stats.tackles * 0.7 +
      stats.interceptions * 0.6 +
      stats.blocks * 0.8 +
      stats.aerialsWon * 0.5 +
      stats.goals * 6 +
      stats.assists * 3 +
      stats.wins * 1.5 +
      stats.draws * 0.5 -
      stats.goalsConceded * 0.5 -
      stats.errors * 3 -
      stats.penaltiesConceded * 2.5 -
      stats.yellowCards * 0.7 -
      stats.redCards * 4 -
      stats.ownGoals * 4 +
      stats.motm * 2
    );
  }

  if (stats.position === "MID") {
    return (
      stats.goals * 5 +
      stats.assists * 3.5 +
      stats.tackles * 0.4 +
      stats.interceptions * 0.35 +
      stats.blocks * 0.3 +
      stats.aerialsWon * 0.25 +
      stats.wins * 1.5 +
      stats.draws * 0.5 -
      stats.goalsConceded * 0.25 -
      stats.errors * 2 -
      stats.ownGoals * 3 -
      stats.yellowCards * 0.5 -
      stats.redCards * 3.5 +
      stats.motm * 2
    );
  }

  return (
    stats.goals * 6 +
    stats.assists * 3.5 +
    stats.tackles * 0.15 +
    stats.interceptions * 0.15 +
    stats.blocks * 0.15 +
    stats.aerialsWon * 0.2 +
    common
  );
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function comparePlayers(a: RoundAwardPlayer, b: RoundAwardPlayer): number {
  return (
    b.impact - a.impact ||
    b.goals - a.goals ||
    b.assists - a.assists ||
    b.saves - a.saves ||
    a.yellowCards + a.redCards - (b.yellowCards + b.redCards) ||
    a.playerId - b.playerId
  );
}

/**
 * Pick the best 4-3-3. If a position group is short, the remaining slots are
 * filled with the next-best player and flagged as out of position.
 */
export function selectTeamOfRound(players: RoundAwardPlayer[]): TeamOfRoundSlot[] {
  const available = [...players].sort(comparePlayers);
  const selected = new Set<number>();
  const team: TeamOfRoundSlot[] = [];

  for (const { slot, count } of ROUND_FORMATION) {
    const group = available.filter(
      (player) => !selected.has(player.playerId) && player.position === slot
    );
    for (let index = 0; index < count; index += 1) {
      const pick = group[index];
      if (!pick) break;
      selected.add(pick.playerId);
      team.push({ slot, player: pick, outOfPosition: false });
    }
  }

  for (const { slot, count } of ROUND_FORMATION) {
    const filled = team.filter((entry) => entry.slot === slot).length;
    for (let index = filled; index < count; index += 1) {
      const pick = available.find((player) => !selected.has(player.playerId));
      if (!pick) break;
      selected.add(pick.playerId);
      team.push({
        slot,
        player: pick,
        outOfPosition: pick.position !== slot,
      });
    }
  }

  return team.sort(
    (a, b) => FORMATION_ORDER[a.slot] - FORMATION_ORDER[b.slot] || b.player.impact - a.player.impact
  );
}

/** Position-specific gate a player must pass to be Player of the Round. */
export function playerOfRoundGate(stats: RoundAwardPlayer): {
  qualifies: boolean;
  criteria: string[];
} {
  if (stats.appearances === 0) return { qualifies: false, criteria: [] };

  if (stats.position === "GK") {
    const criteria: string[] = [];
    if (stats.penaltySaves > 0) criteria.push("Saved a penalty");
    if (stats.saves >= 5) criteria.push("Made 5+ saves");
    if (stats.cleanSheets > 0 && stats.saves >= 3) {
      criteria.push("Clean sheet with 3+ saves");
    }
    return { qualifies: criteria.length > 0 && stats.redCards === 0, criteria };
  }

  if (stats.position === "DEF") {
    const defensiveActions = stats.tackles + stats.interceptions + stats.blocks + stats.aerialsWon;
    const contributions = stats.goals + stats.assists;
    const criteria: string[] = [];
    if ((stats.cleanSheets > 0 || contributions > 0) && defensiveActions >= 4) {
      criteria.push("4+ defensive actions with a clean sheet or contribution");
    }
    if (contributions >= 2) criteria.push("2+ goal contributions");
    return { qualifies: criteria.length > 0 && stats.redCards === 0, criteria };
  }

  if (stats.position === "MID") {
    const contributions = stats.goals + stats.assists;
    const defensiveActions = stats.tackles + stats.interceptions;
    const criteria: string[] = [];
    if (contributions >= 1 && defensiveActions >= 3) {
      criteria.push("Goal contribution + 3 defensive actions");
    }
    if (contributions >= 2) criteria.push("2+ goal contributions");
    return { qualifies: criteria.length > 0 && stats.redCards === 0, criteria };
  }

  const criteria: string[] = [];
  if (stats.goals > 0) criteria.push("Scored a goal");
  if (stats.assists >= 2) criteria.push("2+ assists");
  return { qualifies: criteria.length > 0 && stats.redCards === 0, criteria };
}

/** Highest-impact player who passes their position's qualifying gate. */
export function selectPlayerOfRound(players: RoundAwardPlayer[]): PlayerOfRoundAward | null {
  const eligible = players
    .map((player) => ({ player, gate: playerOfRoundGate(player) }))
    .filter((entry) => entry.gate.qualifies)
    .sort((a, b) => comparePlayers(a.player, b.player));

  if (!eligible.length) return null;
  return { player: eligible[0].player, criteria: eligible[0].gate.criteria };
}

/**
 * Build the complete round award. The Player of the Round is always included
 * in the XI: if a position quota left them out, they replace that position's
 * lowest-scoring selection.
 */
export function buildTeamOfRound(input: TeamOfRoundInput): BuiltTeamOfRound {
  const players = computeRoundPlayerStats(input);
  const team = selectTeamOfRound(players);
  const playerOfRound = selectPlayerOfRound(players);

  if (
    playerOfRound &&
    !team.some((entry) => entry.player.playerId === playerOfRound.player.playerId)
  ) {
    const samePosition = team
      .filter((entry) => entry.slot === playerOfRound.player.position)
      .sort((a, b) => a.player.impact - b.player.impact);
    const lowestOverall = [...team].sort((a, b) => a.player.impact - b.player.impact);
    const replaced = samePosition[0] ?? lowestOverall[0];
    if (replaced) {
      replaced.player = playerOfRound.player;
      replaced.outOfPosition = playerOfRound.player.position !== replaced.slot;
    }
  }

  return { team, playerOfRound, playerCount: players.length };
}
