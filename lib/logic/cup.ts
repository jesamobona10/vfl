import type { CupMatch, CupRound, StandingRow, CompletedVia, Team } from "../types";

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

  const teamName = (id: number) =>
    standings.find((s) => s.id === id)?.name || `Team ${id}`;

  const pairingByPlayoffIndex: Record<number, string> = {};
  playoffMatches.forEach((pm) => {
    if (pm.homeId != null && pm.awayId != null) {
      pairingByPlayoffIndex[pm.matchIndex] =
        `Winner: ${teamName(pm.homeId)} vs ${teamName(pm.awayId)}`;
    }
  });

  const qfData: { homeId: number; awayId: number | null; awayFromMatchId?: number; pairing?: string }[] = [
    { homeId: autoQualifiers[0].id, awayId: null, awayFromMatchId: playoffMatches[2]?.id, pairing: pairingByPlayoffIndex[2] },
    { homeId: autoQualifiers[3].id, awayId: autoQualifiers[4].id },
    { homeId: autoQualifiers[1].id, awayId: null, awayFromMatchId: playoffMatches[1]?.id, pairing: pairingByPlayoffIndex[1] },
    { homeId: autoQualifiers[2].id, awayId: null, awayFromMatchId: playoffMatches[0]?.id, pairing: pairingByPlayoffIndex[0] },
  ];

  const quarterFinals: CupMatch[] = qfData.map((d, i) => ({
    id: nextId++, round: "quarter" as const, matchIndex: i,
    homeId: d.homeId, awayId: d.awayId,
    awayFromMatchId: d.awayFromMatchId,
    homeScore: null, awayScore: null,
    homeETScore: null, awayETScore: null,
    homePenScore: null, awayPenScore: null,
    status: "scheduled" as const, winnerId: null, completedVia: null,
    date: "", time: "", venue: "Veritas Stadium",
    playoffPairing: d.pairing,
  }));

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

export function generateCupBracketFromTeams(teams: Team[]): CupMatch[] {
  const N = teams.length;
  if (N < 2) return [];

  const sorted = [...teams].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  const B = Math.pow(2, Math.ceil(Math.log2(N)));
  const byes = B - N;
  const totalRounds = Math.log2(B);

  const roundLabel = (r: number): CupRound => {
    if (r === totalRounds) return "final";
    if (r === totalRounds - 1) return "semi";
    if (r === totalRounds - 2) return "quarter";
    return "playoff";
  };

  const base: CupMatch[] = [];

  const playInTeams = sorted.slice(byes);
  const firstRoundCount = Math.floor(playInTeams.length / 2);

  const round2Slots: ({ type: "team"; teamId: number } | { type: "match"; matchId: number })[] = [];

  for (let i = 0; i < byes; i++) {
    round2Slots.push({ type: "team", teamId: sorted[i].id });
  }

  const firstRoundMatchIds: number[] = [];
  for (let i = 0; i < firstRoundCount; i++) {
    const matchId = nextId++;
    firstRoundMatchIds.push(matchId);
    base.push({
      id: matchId,
      round: roundLabel(1),
      matchIndex: i,
      homeId: playInTeams[i].id,
      awayId: playInTeams[playInTeams.length - 1 - i].id,
      homeScore: null,
      awayScore: null,
      homeETScore: null,
      awayETScore: null,
      homePenScore: null,
      awayPenScore: null,
      status: "scheduled",
      winnerId: null,
      completedVia: null,
      date: "",
      time: "",
      venue: "Veritas Stadium",
    });
    round2Slots.push({ type: "match", matchId });
  }

  if (totalRounds === 1) return base;

  const round2Count = Math.floor(round2Slots.length / 2);
  const prevMatchIds: number[][] = [firstRoundMatchIds];

  for (let r = 2; r <= totalRounds; r++) {
    const prevIds = prevMatchIds[prevMatchIds.length - 1] ?? [];
    const slots = r === 2 ? round2Slots : null;
    const matchCount = r === 2 ? round2Count : Math.floor(prevIds.length / 2);
    const currentMatchIds: number[] = [];

    for (let i = 0; i < matchCount; i++) {
      const matchId = nextId++;
      currentMatchIds.push(matchId);

      let homeId: number | null = null;
      let awayId: number | null = null;
      let homeFromMatchId: number | undefined;
      let awayFromMatchId: number | undefined;

      if (r === 2 && slots) {
        const left = slots[i * 2];
        const right = slots[i * 2 + 1];
        if (left.type === "team") homeId = left.teamId;
        else homeFromMatchId = left.matchId;
        if (right.type === "team") awayId = right.teamId;
        else awayFromMatchId = right.matchId;
      } else {
        homeFromMatchId = prevIds[i * 2];
        awayFromMatchId = prevIds[i * 2 + 1];
      }

      base.push({
        id: matchId,
        round: roundLabel(r),
        matchIndex: i,
        homeId,
        awayId,
        homeFromMatchId,
        awayFromMatchId,
        homeScore: null,
        awayScore: null,
        homeETScore: null,
        awayETScore: null,
        homePenScore: null,
        awayPenScore: null,
        status: "scheduled",
        winnerId: null,
        completedVia: null,
        date: "",
        time: "",
        venue: "Veritas Stadium",
      });
    }

    prevMatchIds.push(currentMatchIds);
  }

  return base;
}
