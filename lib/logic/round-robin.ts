import type { FixtureRound, Match } from "../types";
import { pairKey } from "../utils/helpers";

function getPairKey(m: { homeId: number; awayId: number }): string {
  return pairKey(m.homeId, m.awayId);
}

export function generateRoundRobinFixtures(
  teams: { id: number; name: string }[],
  existingFixtures?: FixtureRound[]
): FixtureRound[] {
  if (!Array.isArray(teams) || teams.length < 2) {
    throw new Error("At least 2 teams are required.");
  }
  const names = teams.map((team) => team.name.trim());
  if (names.some((name) => !name)) {
    throw new Error("Enter all team names before generating fixtures.");
  }
  if (new Set(names.map((name) => name.toLowerCase())).size !== names.length) {
    throw new Error("Team names must be unique before generating fixtures.");
  }

  const teamIds = teams.map((t) => t.id);
  const n = teamIds.length;

  // Step 1: Generate ideal round-robin pairings using the circle method
  const isOdd = n % 2 === 1;
  const circle: (number | null)[] = [...teamIds];
  if (isOdd) circle.push(null);
  const total = circle.length;

  const roundPairings: { pairs: [number, number][]; byeId: number | null }[] = [];
  for (let r = 0; r < total - 1; r++) {
    const pairs: [number, number][] = [];
    let byeId: number | null = null;
    for (let i = 0; i < total / 2; i++) {
      const left = circle[i];
      const right = circle[total - 1 - i];
      if (left === null || right === null) {
        byeId = left !== null ? left : right;
      } else {
        pairs.push([left, right]);
      }
    }
    roundPairings.push({ pairs, byeId });
    const last = circle.pop()!;
    circle.splice(1, 0, last);
  }

  // Kickoff reorder: team with bye in previous round leads the next
  roundPairings.forEach((rp, i) => {
    if (i === 0) return;
    const prevBye = roundPairings[i - 1].byeId;
    const idx = rp.pairs.findIndex(([h, a]) => h === prevBye || a === prevBye);
    if (idx !== -1) {
      const p = rp.pairs.splice(idx, 1)[0];
      if (p[1] === prevBye) p.reverse();
      rp.pairs.unshift(p);
    }
  });

  // Step 2: If no existing fixtures, build fresh
  if (!Array.isArray(existingFixtures) || existingFixtures.length === 0) {
    let matchId = 1;
    return roundPairings.map((rp, i) => ({
      round: i + 1,
      byeId: rp.byeId,
      matches: rp.pairs.map(([homeId, awayId]) => ({
        id: matchId++,
        round: i + 1,
        homeId,
        awayId,
        homeScore: null,
        awayScore: null,
        status: "scheduled" as const,
        date: "",
        time: "",
        venue: "",
        events: [],
      })),
    }));
  }

  // Step 3: Merge — preserve locked matches, fill gaps with ideal pairings
  const existingByRound = new Map<number, FixtureRound>();
  existingFixtures.forEach((r) => existingByRound.set(r.round, r));

  const lockedMatchIds = new Set<number>();
  const usedPairs = new Set<string>();
  const roundTeamUsage = new Map<number, Set<number>>();

  for (const [, r] of existingByRound) {
    if (!roundTeamUsage.has(r.round)) roundTeamUsage.set(r.round, new Set());
    const rteams = roundTeamUsage.get(r.round)!;
    for (const m of r.matches) {
      if (
        m.status === "completed" ||
        m.status === "scheduled" ||
        m.status === "in-progress" ||
        m.status === "live" ||
        m.manualEdited
      ) {
        lockedMatchIds.add(m.id);
        usedPairs.add(getPairKey(m));
        rteams.add(m.homeId);
        rteams.add(m.awayId);
      }
    }
  }

  const allIds = existingFixtures.flatMap((r) => r.matches.map((m) => m.id));
  let nextId = allIds.length ? Math.max(...allIds) + 1 : 1;
  const result: FixtureRound[] = roundPairings.map((rp, i) => {
    const roundNum = i + 1;
    const existingRound = existingByRound.get(roundNum);
    const roundTeams = new Set(roundTeamUsage.get(roundNum) || []);
    const matches: Match[] = [];

    // Preserve locked matches in this round
    if (existingRound) {
      existingRound.matches.forEach((m) => {
        if (lockedMatchIds.has(m.id)) matches.push(m);
      });
    }

    // Fill remaining slots from ideal pairings
    const matchesPerRound = Math.floor(n / 2);

    for (const [idealHome, idealAway] of rp.pairs) {
      if (matches.length >= matchesPerRound) break;
      const key = pairKey(idealHome, idealAway);
      if (usedPairs.has(key)) continue;
      if (roundTeams.has(idealHome) || roundTeams.has(idealAway)) continue;

      usedPairs.add(key);
      roundTeams.add(idealHome);
      roundTeams.add(idealAway);

      let reused = false;
      if (existingRound) {
        for (const em of existingRound.matches) {
          if (lockedMatchIds.has(em.id)) continue;
          if (getPairKey(em) === key) {
            em.homeId = idealHome;
            em.awayId = idealAway;
            matches.push(em);
            reused = true;
            break;
          }
        }
      }

      if (!reused) {
        matches.push({
          id: nextId++,
          round: roundNum,
          homeId: idealHome,
          awayId: idealAway,
          homeScore: null,
          awayScore: null,
          status: "scheduled",
          date: "",
          time: "",
          venue: "",
          events: [],
        });
      }
    }

    return {
      round: roundNum,
      byeId: rp.byeId,
      matches,
    };
  });

  // Step 3.5: Fill missing slots with constraint-based solver
  const usedP = new Set<string>();
  const roundTeams2 = new Map<number, Set<number>>();
  result.forEach((r) => {
    roundTeams2.set(r.round, new Set());
    r.matches.forEach((m) => {
      usedP.add(getPairKey(m));
      roundTeams2.get(r.round)!.add(m.homeId);
      roundTeams2.get(r.round)!.add(m.awayId);
    });
  });

  const allPairs: [number, number][] = [];
  for (let i = 0; i < teamIds.length; i++)
    for (let j = i + 1; j < teamIds.length; j++) allPairs.push([teamIds[i], teamIds[j]]);

  const missing = allPairs.filter(([h, a]) => !usedP.has(pairKey(h, a)));
  const perRound = Math.floor(n / 2);

  if (missing.length > 0) {
    let gapNextId = nextId;

    function solveGaps(remaining: [number, number][]): boolean {
      if (remaining.length === 0) return true;
      const sorted = remaining
        .map(([h, a]) => ({
          pair: [h, a] as [number, number],
          rounds: result.filter(
            (r) =>
              r.matches.length < perRound &&
              !roundTeams2.get(r.round)!.has(h) &&
              !roundTeams2.get(r.round)!.has(a)
          ),
        }))
        .sort((a, b) => a.rounds.length - b.rounds.length);
      if (sorted[0].rounds.length === 0) return false;
      const [h, a] = sorted[0].pair;
      for (const round of sorted[0].rounds) {
        const id = gapNextId++;
        round.matches.push({
          id,
          round: round.round,
          homeId: h,
          awayId: a,
          homeScore: null,
          awayScore: null,
          status: "scheduled",
          date: "",
          time: "",
          venue: "",
          events: [],
        });
        usedP.add(pairKey(h, a));
        roundTeams2.get(round.round)!.add(h);
        roundTeams2.get(round.round)!.add(a);
        const rest = remaining.filter(([x, y]) => !(x === h && y === a));
        if (solveGaps(rest)) return true;
        round.matches.pop();
        usedP.delete(pairKey(h, a));
        roundTeams2.get(round.round)!.delete(h);
        roundTeams2.get(round.round)!.delete(a);
      }
      return false;
    }

    solveGaps(missing);
  }

  return result;
}
