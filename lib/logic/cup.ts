import type { CupMatch, StandingRow, CompletedVia } from "../types";

let nextId = 1;

export function resetCupIdCounter() {
  nextId = 1;
}

export function generatePlayoffs(standings: StandingRow[]): CupMatch[] {
  const playoffTeams = standings.slice(5, 11);
  if (playoffTeams.length !== 6) return [];

  const pairs: [number, number][] = [
    [playoffTeams[3].id, playoffTeams[4].id],
    [playoffTeams[1].id, playoffTeams[5].id],
    [playoffTeams[0].id, playoffTeams[2].id],
  ];

  return pairs.map(([homeId, awayId], i) => ({
    id: nextId++,
    round: "playoff" as const,
    matchIndex: i,
    homeId,
    awayId,
    homeScore: null,
    awayScore: null,
    homeETScore: null,
    awayETScore: null,
    homePenScore: null,
    awayPenScore: null,
    status: "scheduled" as const,
    winnerId: null,
    completedVia: null,
    date: "",
    time: "",
    venue: "Veritas Stadium",
  }));
}

export function generateCupBracket(
  standings: StandingRow[],
  playoffMatches: CupMatch[]
): CupMatch[] {
  const autoQualifiers = standings.slice(0, 5);
  if (autoQualifiers.length !== 5) return [];

  const playoffWinners = playoffMatches
    .filter((m) => m.status === "completed" && m.winnerId != null)
    .sort((a, b) => a.matchIndex - b.matchIndex)
    .map((m) => m.winnerId!);

  if (playoffWinners.length !== 3) return [];

  const seeds = [
    { id: autoQualifiers[0].id, name: autoQualifiers[0].name },
    { id: autoQualifiers[1].id, name: autoQualifiers[1].name },
    { id: autoQualifiers[2].id, name: autoQualifiers[2].name },
    { id: autoQualifiers[3].id, name: autoQualifiers[3].name },
    { id: autoQualifiers[4].id, name: autoQualifiers[4].name },
    { id: playoffWinners[0], name: "" },
    { id: playoffWinners[1], name: "" },
    { id: playoffWinners[2], name: "" },
  ];

  const quarterFinals: CupMatch[] = [
    {
      id: nextId++, round: "quarter", matchIndex: 0,
      homeId: seeds[0].id, awayId: seeds[7].id,
      homeScore: null, awayScore: null,
      homeETScore: null, awayETScore: null,
      homePenScore: null, awayPenScore: null,
      status: "scheduled", winnerId: null, completedVia: null,
      date: "", time: "", venue: "Veritas Stadium",
    },
    {
      id: nextId++, round: "quarter", matchIndex: 1,
      homeId: seeds[3].id, awayId: seeds[4].id,
      homeScore: null, awayScore: null,
      homeETScore: null, awayETScore: null,
      homePenScore: null, awayPenScore: null,
      status: "scheduled", winnerId: null, completedVia: null,
      date: "", time: "", venue: "Veritas Stadium",
    },
    {
      id: nextId++, round: "quarter", matchIndex: 2,
      homeId: seeds[1].id, awayId: seeds[6].id,
      homeScore: null, awayScore: null,
      homeETScore: null, awayETScore: null,
      homePenScore: null, awayPenScore: null,
      status: "scheduled", winnerId: null, completedVia: null,
      date: "", time: "", venue: "Veritas Stadium",
    },
    {
      id: nextId++, round: "quarter", matchIndex: 3,
      homeId: seeds[2].id, awayId: seeds[5].id,
      homeScore: null, awayScore: null,
      homeETScore: null, awayETScore: null,
      homePenScore: null, awayPenScore: null,
      status: "scheduled", winnerId: null, completedVia: null,
      date: "", time: "", venue: "Veritas Stadium",
    },
  ];

  const semiFinals: CupMatch[] = [
    {
      id: nextId++, round: "semi", matchIndex: 0,
      homeId: null, awayId: null,
      homeFromMatchId: quarterFinals[0].id,
      awayFromMatchId: quarterFinals[1].id,
      homeScore: null, awayScore: null,
      homeETScore: null, awayETScore: null,
      homePenScore: null, awayPenScore: null,
      status: "scheduled", winnerId: null, completedVia: null,
      date: "", time: "", venue: "Veritas Stadium",
    },
    {
      id: nextId++, round: "semi", matchIndex: 1,
      homeId: null, awayId: null,
      homeFromMatchId: quarterFinals[2].id,
      awayFromMatchId: quarterFinals[3].id,
      homeScore: null, awayScore: null,
      homeETScore: null, awayETScore: null,
      homePenScore: null, awayPenScore: null,
      status: "scheduled", winnerId: null, completedVia: null,
      date: "", time: "", venue: "Veritas Stadium",
    },
  ];

  const final: CupMatch[] = [
    {
      id: nextId++, round: "final", matchIndex: 0,
      homeId: null, awayId: null,
      homeFromMatchId: semiFinals[0].id,
      awayFromMatchId: semiFinals[1].id,
      homeScore: null, awayScore: null,
      homeETScore: null, awayETScore: null,
      homePenScore: null, awayPenScore: null,
      status: "scheduled", winnerId: null, completedVia: null,
      date: "", time: "", venue: "Veritas Stadium",
    },
  ];

  return [...quarterFinals, ...semiFinals, ...final];
}

export function computeWinner(match: CupMatch): {
  winnerId: number | null;
  completedVia: CompletedVia | null;
} {
  const reg = getRegularScore(match);
  if (reg.home !== null && reg.away !== null && reg.home !== reg.away) {
    return {
      winnerId: reg.home > reg.away ? match.homeId : match.awayId,
      completedVia: "regular",
    };
  }

  const et = getETScore(match);
  if (et.home !== null && et.away !== null && et.home !== et.away) {
    return {
      winnerId: et.home > et.away ? match.homeId : match.awayId,
      completedVia: "extra_time",
    };
  }

  const pen = getPenScore(match);
  if (pen.home !== null && pen.away !== null && pen.home !== pen.away) {
    return {
      winnerId: pen.home > pen.away ? match.homeId : match.awayId,
      completedVia: "penalties",
    };
  }

  return { winnerId: null, completedVia: null };
}

export function getRegularScore(match: CupMatch): { home: number | null; away: number | null } {
  return { home: match.homeScore, away: match.awayScore };
}

export function getETScore(match: CupMatch): { home: number | null; away: number | null } {
  return { home: match.homeETScore, away: match.awayETScore };
}

export function getPenScore(match: CupMatch): { home: number | null; away: number | null } {
  return { home: match.homePenScore, away: match.awayPenScore };
}

export function resolveBracketSlot(
  matches: CupMatch[],
  completedMatchId: number,
  winnerId: number
): CupMatch[] {
  return matches.map((m) => {
    if (m.homeFromMatchId === completedMatchId) {
      return { ...m, homeId: winnerId };
    }
    if (m.awayFromMatchId === completedMatchId) {
      return { ...m, awayId: winnerId };
    }
    return m;
  });
}

export function getChampion(matches: CupMatch[]): number | null {
  const finalMatch = matches.find((m) => m.round === "final");
  if (finalMatch && finalMatch.status === "completed" && finalMatch.winnerId != null) {
    return finalMatch.winnerId;
  }
  return null;
}
