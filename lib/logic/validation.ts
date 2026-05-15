import type { FixtureRound, Team, VerifyResult } from "../types";
import { pairKey, teamName } from "../utils/helpers";
import { allMatches } from "./standings";

export function validateFixtureStructure(
  fixtures: FixtureRound[],
  teams: Team[]
): string[] {
  const errs: string[] = [];
  const matches = fixtures.flatMap((r) => r.matches);
  const expectedMatches = (teams.length * (teams.length - 1)) / 2;
  const pairs = new Set<string>();
  const teamCount = new Map(teams.map((t) => [t.id, 0]));

  fixtures.forEach((r) => {
    const seen = new Set<number>();
    r.matches.forEach((m) => {
      [m.homeId, m.awayId].forEach((id) => {
        if (seen.has(id))
          errs.push(`Team ${teamName(id, teams)} appears twice in round ${r.round}.`);
        seen.add(id);
      });
      const key = pairKey(m.homeId, m.awayId);
      if (pairs.has(key))
        errs.push(`Duplicate pairing in round ${r.round} match ${m.id}.`);
      pairs.add(key);
      teamCount.set(m.homeId, (teamCount.get(m.homeId) || 0) + 1);
      teamCount.set(m.awayId, (teamCount.get(m.awayId) || 0) + 1);
    });
    const missing = teams.filter((t) => !seen.has(t.id));
    if (missing.length !== 1) {
      errs.push(`Round ${r.round} should have exactly 1 bye team.`);
    }
  });

  if (matches.length !== expectedMatches) {
    errs.push(`Expected ${expectedMatches} total matches, got ${matches.length}.`);
  }

  teams.forEach((t) => {
    const count = teamCount.get(t.id) || 0;
    const expected = teams.length - 1;
    if (count !== expected) {
      errs.push(`${t.name} has ${count} matches instead of ${expected}.`);
    }
  });

  return errs;
}

export function verifyFixtures(
  fixtures: FixtureRound[],
  teams: Team[]
): VerifyResult {
  const errors: string[] = [];
  const matches = fixtures.flatMap((round) => round.matches);
  const expectedMatches = (teams.length * (teams.length - 1)) / 2;
  const pairs = new Set<string>();
  const appearances = new Map(teams.map((team) => [team.id, 0]));
  const byes = new Map(teams.map((team) => [team.id, 0]));

  if (fixtures.length !== 11) {
    errors.push(`Expected 11 rounds, found ${fixtures.length}.`);
  }

  if (matches.length !== expectedMatches) {
    errors.push(`Expected ${expectedMatches} matches, found ${matches.length}.`);
  }

  fixtures.forEach((round) => {
    const roundTeams = new Set<number>();
    if (round.matches.length !== 5) {
      errors.push(`Round ${round.round} should contain 5 matches.`);
    }
    round.matches.forEach((match) => {
      [match.homeId, match.awayId].forEach((teamId) => {
        if (roundTeams.has(teamId)) {
          errors.push(
            `Team ${teamName(teamId, teams)} appears more than once in round ${round.round}.`
          );
        }
        roundTeams.add(teamId);
      });
    });
    const missingTeams = teams.filter((team) => !roundTeams.has(team.id));
    if (missingTeams.length === 1) {
      byes.set(missingTeams[0].id, (byes.get(missingTeams[0].id) || 0) + 1);
    } else {
      errors.push(`Round ${round.round} should have exactly one bye team.`);
    }
  });

  matches.forEach((match) => {
    if (match.homeId === match.awayId) {
      errors.push(`Match ${match.id} has a team playing itself.`);
    }

    const pair = [match.homeId, match.awayId].sort((a, b) => a - b).join("-");
    if (pairs.has(pair)) {
      errors.push(`Duplicate pairing found in match ${match.id}.`);
    }
    pairs.add(pair);

    appearances.set(match.homeId, (appearances.get(match.homeId) || 0) + 1);
    appearances.set(match.awayId, (appearances.get(match.awayId) || 0) + 1);
  });

  teams.forEach((team) => {
    if (appearances.get(team.id) !== 10) {
      errors.push(
        `${team.name} plays ${appearances.get(team.id)} matches instead of 10.`
      );
    }
    if (byes.get(team.id) !== 1) {
      errors.push(`${team.name} has ${byes.get(team.id)} byes instead of 1.`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function scheduleConflict(
  match: { id: number; date: string; homeId: number; awayId: number },
  fixtures: FixtureRound[]
): string {
  if (!match.date) return "";
  const conflict = allMatches(fixtures).find((candidate) => {
    if (candidate.id === match.id || candidate.date !== match.date) return false;
    return (
      candidate.homeId === match.homeId ||
      candidate.awayId === match.homeId ||
      candidate.homeId === match.awayId ||
      candidate.awayId === match.awayId
    );
  });
  return conflict ? `Conflict with match ${conflict.id} on ${match.date}` : "";
}

export function fixtureIssue(
  match: { id: number; round: number; homeId: number; awayId: number },
  fixtures: FixtureRound[]
): string {
  if (match.homeId === match.awayId) {
    return "Home and away teams cannot be the same.";
  }

  const pair = [match.homeId, match.awayId].sort((a, b) => a - b).join("-");
  const duplicate = allMatches(fixtures).find((candidate) => {
    if (candidate.id === match.id) return false;
    return [candidate.homeId, candidate.awayId].sort((a, b) => a - b).join("-") === pair;
  });
  if (duplicate) {
    return `Duplicate pairing with match ${duplicate.id}.`;
  }

  const sameRound = fixtures
    .find((round) => round.round === match.round)
    ?.matches.find((candidate) => {
      if (candidate.id === match.id) return false;
      return (
        candidate.homeId === match.homeId ||
        candidate.awayId === match.homeId ||
        candidate.homeId === match.awayId ||
        candidate.awayId === match.awayId
      );
    });
  return sameRound ? `Round conflict with match ${sameRound.id}.` : "";
}

export function allTeamPairs(teams: Team[]): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i < teams.length; i += 1) {
    for (let j = i + 1; j < teams.length; j += 1) {
      pairs.push([teams[i].id, teams[j].id]);
    }
  }
  return pairs;
}
