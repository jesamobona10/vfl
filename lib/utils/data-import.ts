import type { Team, FixtureRound, Match, Player } from "../types";

export interface ImportData {
  teams: Team[];
  fixtures: FixtureRound[];
  players: Player[];
}

export interface ImportPlan {
  teams: Team[];
  fixtures: FixtureRound[];
  players: Player[];
  mapping: [number, number][];
}

export function parseImportFile(json: unknown): ImportData | { error: string } {
  if (!json || typeof json !== "object") {
    return { error: "Invalid JSON: must be an object." };
  }
  const data = json as Record<string, unknown>;
  if (!Array.isArray(data.teams)) {
    return { error: "Missing or invalid 'teams' array." };
  }
  for (const t of data.teams) {
    if (!t || typeof t !== "object" || typeof (t as any).id !== "number" || !(t as any).name) {
      return { error: `Invalid team entry: ${JSON.stringify(t)}` };
    }
  }
  if (!Array.isArray(data.fixtures)) {
    return { error: "Missing or invalid 'fixtures' array." };
  }
  for (const r of data.fixtures) {
    if (!r || typeof r !== "object" || typeof (r as any).round !== "number" || !Array.isArray((r as any).matches)) {
      return { error: `Invalid fixture round: ${JSON.stringify(r)}` };
    }
  }
  if (!Array.isArray(data.players)) {
    return { error: "Missing or invalid 'players' array." };
  }
  for (const p of data.players) {
    if (p && typeof p === "object" && typeof (p as any).id === "number" && typeof (p as any).teamId === "number") {
      // valid
    } else if (p) {
      return { error: `Invalid player entry: ${JSON.stringify(p)}` };
    }
  }
  return data as unknown as ImportData;
}

export function buildImportPlan(
  source: ImportData,
  internalTeams: Team[]
): ImportPlan {
  const mapping: [number, number][] = [];
  const usedInternalIds = new Set<number>();
  const nameToInternal = new Map<string, Team>();
  for (const t of internalTeams) {
    const key = t.name.toLowerCase().trim();
    if (!nameToInternal.has(key)) {
      nameToInternal.set(key, t);
    }
  }

  for (const srcTeam of source.teams) {
    const key = srcTeam.name.toLowerCase().trim();
    const match = nameToInternal.get(key);
    if (match && !usedInternalIds.has(match.id)) {
      mapping.push([srcTeam.id, match.id]);
      usedInternalIds.add(match.id);
    }
  }

  let nextId = internalTeams.length > 0 ? Math.max(...internalTeams.map((t) => t.id)) + 1 : 1;
  const matchedSourceIds = new Set(mapping.map(([src]) => src));

  for (const srcTeam of source.teams) {
    if (!matchedSourceIds.has(srcTeam.id)) {
      mapping.push([srcTeam.id, nextId++]);
    }
  }

  const mappingMap = new Map<number, number>(mapping);
  const finalTeams: Team[] = source.teams.map((src) => {
    const newId = mappingMap.get(src.id)!;
    const existingTeam = internalTeams.find((t) => t.id === newId && t.name.toLowerCase().trim() === src.name.toLowerCase().trim());
    const existingLogo = existingTeam?.logo;
    return {
      ...src,
      id: newId,
      logo: src.logo || existingLogo,
    };
  });

  const fixtures: FixtureRound[] = source.fixtures.map((round) => ({
    ...round,
    matches: round.matches.map((m) => ({
      ...m,
      homeId: mappingMap.get(m.homeId) ?? m.homeId,
      awayId: mappingMap.get(m.awayId) ?? m.awayId,
    })),
  }));

  const players: Player[] = source.players.map((p) => ({
    ...p,
    teamId: mappingMap.get(p.teamId) ?? p.teamId,
  }));

  return { teams: finalTeams, fixtures, players, mapping };
}
