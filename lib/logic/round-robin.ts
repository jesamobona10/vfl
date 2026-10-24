import type { FixtureRound, Match } from "../types";
import { pairKey } from "../utils/helpers";

function getPairKey(m: { homeId: number; awayId: number }): string {
  return pairKey(m.homeId, m.awayId);
}

/** Deterministic PRNG so a given seed always produces the same schedule. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const rand = mulberry32(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Circle-method pairings for one full single round-robin, with rotating byes. */
function buildRoundPairings(teamIds: number[]): { pairs: [number, number][]; byeId: number | null }[] {
  const isOdd = teamIds.length % 2 === 1;
  const circle: (number | null)[] = [...teamIds];
  if (isOdd) circle.push(null);
  const total = circle.length;

  const rounds: { pairs: [number, number][]; byeId: number | null }[] = [];
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
    rounds.push({ pairs, byeId });
    const last = circle.pop()!;
    circle.splice(1, 0, last);
  }
  return rounds;
}

export interface FriendlyOptions {
  /** Games each team should play. Must be between 1 and teams − 1. */
  gamesPerTeam: number;
  /** Seed for the shuffle; the same seed yields the same schedule. */
  seed?: number;
  /** Optional category per team id; when set, only same-category pairs are kept. */
  categories?: Record<number, string>;
}

/**
 * Generate a friendly schedule: a seeded shuffle of the teams, then the first
 * `gamesPerTeam` rounds of the standard circle method.
 *
 * With an even team count every team plays exactly `gamesPerTeam` games. With an
 * odd count each round has a bye, so `gamesPerTeam` teams play one game fewer —
 * the caller can add a manual fixture to balance.
 */
export function generateFriendlyFixtures(
  teams: { id: number; name: string }[],
  options: FriendlyOptions
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

  const { gamesPerTeam, seed = 1, categories } = options;
  if (!Number.isInteger(gamesPerTeam) || gamesPerTeam < 1) {
    throw new Error("Choose at least 1 game per team.");
  }
  if (gamesPerTeam > teams.length - 1) {
    throw new Error(`Each team can play at most ${teams.length - 1} games.`);
  }

  const shuffledIds = seededShuffle(teams.map((t) => t.id), seed);
  const rounds = buildRoundPairings(shuffledIds).slice(0, gamesPerTeam);

  let matchId = 1;
  return rounds.map((rp, i) => {
    const pairs = categories
      ? rp.pairs.filter(([h, a]) => categories[h] && categories[h] === categories[a])
      : rp.pairs;
    return {
      round: i + 1,
      byeId: rp.byeId,
      matches: pairs.map(([homeId, awayId]) => ({
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
    };
  });
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

export type Pair = [number, number]; // [homeId, awayId]

export function completeSingleRoundRobin(teamIds: number[], matchday1: Pair[]) {
  const n = teamIds.length,
    odd = n % 2 === 1,
    total = odd ? n + 1 : n,
    half = total / 2;

  const used = new Set<number>();
  for (const [a, b] of matchday1) {
    if (a === b || used.has(a) || used.has(b)) throw new Error("Matchday 1 uses a team twice");
    used.add(a);
    used.add(b);
  }
  const unscheduled = teamIds.filter((t) => !used.has(t));
  if (odd ? unscheduled.length !== 1 : unscheduled.length !== 0) {
    throw new Error(`Matchday 1 must cover every team${odd ? " except one bye" : ""}`);
  }

  const circle: (number | null)[] = new Array(total).fill(null);
  matchday1.forEach(([a, b], i) => {
    circle[i] = a;
    circle[total - 1 - i] = b;
  });
  if (odd) {
    circle[matchday1.length] = unscheduled[0];
    circle[total - 1 - matchday1.length] = null;
  }

  const home = new Map<number, number>(),
    away = new Map<number, number>();
  const get = (m: Map<number, number>, t: number) => m.get(t) ?? 0;
  const rounds: { round: number; byeId: number | null; pairs: Pair[] }[] = [];

  for (let r = 0; r < total - 1; r++) {
    const pairs: Pair[] = [];
    let bye: number | null = null;
    for (let i = 0; i < half; i++) {
      const l = circle[i],
        rt = circle[total - 1 - i];
      if (l === null || rt === null) {
        bye = l ?? rt;
        continue;
      }
      let h = l,
        a = rt;
      if (r === 0) {
        const m = matchday1.find(([x, y]) => (x === l && y === rt) || (x === rt && y === l))!;
        h = m[0];
        a = m[1]; // keep matchday 1 exactly as entered
      } else if (get(home, h) - get(away, h) > get(home, a) - get(away, a)) {
        [h, a] = [a, h];
      }
      home.set(h, get(home, h) + 1);
      away.set(a, get(away, a) + 1);
      pairs.push([h, a]);
    }
    rounds.push({ round: r + 1, byeId: bye, pairs });
    const last = circle.pop()!;
    circle.splice(1, 0, last); // rotate, slot 0 fixed
  }

  // Balancing pass: flip later matches while it reduces total imbalance.
  const imb = (t: number) => get(home, t) - get(away, t);
  for (let guard = 0, changed = true; changed && guard < 200; guard++) {
    changed = false;
    for (const rd of rounds.slice(1))
      for (const p of rd.pairs) {
        const [h, a] = p;
        if (Math.abs(imb(h) - 2) + Math.abs(imb(a) + 2) < Math.abs(imb(h)) + Math.abs(imb(a))) {
          home.set(h, get(home, h) - 1);
          away.set(h, get(away, h) + 1);
          away.set(a, get(away, a) - 1);
          home.set(a, get(home, a) + 1);
          p[0] = a;
          p[1] = h;
          changed = true;
        }
      }
  }
  return rounds;
}
