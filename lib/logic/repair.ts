import type { FixtureRound, Team, RepairResult, Match } from "../types";
import { pairKey, teamName } from "../utils/helpers";
import { allTeamPairs } from "./validation";
import { allMatches } from "./standings";

export function swapTeamsAcrossFixtures(
  oldTeamId: number,
  newTeamId: number,
  editedMatchId: number,
  fixtures: FixtureRound[]
): number {
  let changed = 0;
  allMatches(fixtures).forEach((candidate) => {
    if (candidate.id === editedMatchId) return;

    const previousHomeId = candidate.homeId;
    const previousAwayId = candidate.awayId;

    if (candidate.homeId === oldTeamId) {
      candidate.homeId = newTeamId;
    } else if (candidate.homeId === newTeamId) {
      candidate.homeId = oldTeamId;
    }

    if (candidate.awayId === oldTeamId) {
      candidate.awayId = newTeamId;
    } else if (candidate.awayId === newTeamId) {
      candidate.awayId = oldTeamId;
    }

    if (
      candidate.homeId !== previousHomeId ||
      candidate.awayId !== previousAwayId
    ) {
      candidate.autoAdjusted = true;
      changed += 1;
    }
  });
  return changed;
}

export function repairFixturesFromLocks(
  fixtures: FixtureRound[],
  teams: Team[]
): RepairResult {
  if (!fixtures.length) {
    return { ok: true, changed: 0 };
  }

  const matches = allMatches(fixtures);
  const lockedMatches = matches.filter(
    (match) =>
      match.manualEdited ||
      match.status === "completed" ||
      match.status === "scheduled" ||
      match.status === "in-progress" ||
      match.status === "live"
  );
  const openMatches = matches.filter(
    (match) => !lockedMatches.includes(match)
  );
  const usedPairs = new Set<string>();
  const roundTeams = new Map(
    fixtures.map((round) => [round.round, new Set<number>()])
  );
  const originalPairs = new Map(
    matches.map((match) => [match.id, [match.homeId, match.awayId]])
  );

  for (const match of lockedMatches) {
    if (match.homeId === match.awayId) {
      return {
        ok: false,
        reason: `${teamName(match.homeId, teams)} cannot play itself in match ${match.id}.`,
      };
    }
    const key = pairKey(match.homeId, match.awayId);
    if (usedPairs.has(key)) {
      return {
        ok: false,
        reason: `Locked fixtures contain a duplicate pairing at match ${match.id}.`,
      };
    }
    usedPairs.add(key);

    const teamsInRound = roundTeams.get(match.round)!;
    if (teamsInRound.has(match.homeId) || teamsInRound.has(match.awayId)) {
      return {
        ok: false,
        reason: `Locked fixtures create a round conflict in round ${match.round}.`,
      };
    }
    teamsInRound.add(match.homeId);
    teamsInRound.add(match.awayId);
  }

  const pairLookup = new Map(
    allTeamPairs(teams).map(([homeId, awayId]) => [
      pairKey(homeId, awayId),
      [homeId, awayId] as [number, number],
    ])
  );
  const remainingPairKeys = new Set(
    [...pairLookup.keys()].filter((key) => !usedPairs.has(key))
  );
  const assigned = new Set<number>();
  const slotAssignments = new Map<number, [number, number]>();
  let solveIterations = 0;
  const MAX_SOLVE_ITERATIONS = 50000;
  const solveStartTime = Date.now();
  const SOLVE_TIMEOUT_MS = 3000;

  function candidatesFor(match: Match) {
    const teamsInRound = roundTeams.get(match.round)!;
    const currentKey = pairKey(match.homeId, match.awayId);
    const originalKey = pairKey(...(originalPairs.get(match.id) as [number, number]));
    return [...remainingPairKeys]
      .map((key) => pairLookup.get(key)!)
      .filter(
        ([homeId, awayId]) =>
          !teamsInRound.has(homeId) && !teamsInRound.has(awayId)
      )
      .sort((a, b) => {
        const aKey = pairKey(...a);
        const bKey = pairKey(...b);
        const aScore = (aKey === currentKey ? -2 : 0) + (aKey === originalKey ? -1 : 0);
        const bScore = (bKey === currentKey ? -2 : 0) + (bKey === originalKey ? -1 : 0);
        return aScore - bScore;
      });
  }

  function solve(): boolean {
    solveIterations++;
    if (solveIterations > MAX_SOLVE_ITERATIONS) return false;
    if (Date.now() - solveStartTime > SOLVE_TIMEOUT_MS) return false;

    if (assigned.size === openMatches.length) {
      return true;
    }

    let bestMatch: Match | null = null;
    let bestCandidates: [number, number][] | null = null;
    for (const match of openMatches) {
      if (assigned.has(match.id)) continue;
      const candidates = candidatesFor(match);
      if (!bestCandidates || candidates.length < bestCandidates.length) {
        bestMatch = match;
        bestCandidates = candidates;
      }
      if (bestCandidates.length === 0) break;
    }

    if (!bestMatch || bestCandidates!.length === 0) {
      return false;
    }

    assigned.add(bestMatch.id);
    const teamsInRound = roundTeams.get(bestMatch.round)!;
    for (const [homeId, awayId] of bestCandidates!) {
      const key = pairKey(homeId, awayId);
      remainingPairKeys.delete(key);
      teamsInRound.add(homeId);
      teamsInRound.add(awayId);
      slotAssignments.set(bestMatch.id, [homeId, awayId]);

      if (solve()) {
        return true;
      }

      slotAssignments.delete(bestMatch.id);
      teamsInRound.delete(homeId);
      teamsInRound.delete(awayId);
      remainingPairKeys.add(key);
    }
    assigned.delete(bestMatch.id);
    return false;
  }

  if (!solve()) {
    if (
      solveIterations > MAX_SOLVE_ITERATIONS ||
      Date.now() - solveStartTime > SOLVE_TIMEOUT_MS
    ) {
      return {
        ok: false,
        reason:
          "Fixture repair timed out — too many locked matches create an unsolvable constraint. Try resetting fixtures or locking fewer matches.",
      };
    }
    return {
      ok: false,
      reason: "No valid fixture repair found with the current locked matches.",
    };
  }

  let changed = 0;
  for (const match of openMatches) {
    const assignment = slotAssignments.get(match.id);
    if (!assignment) continue;
    const [homeId, awayId] = assignment;
    if (match.homeId !== homeId || match.awayId !== awayId) {
      match.homeId = homeId;
      match.awayId = awayId;
      match.autoAdjusted = true;
      changed += 1;
    }
  }

  return { ok: true, changed };
}
