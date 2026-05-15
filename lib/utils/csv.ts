import type { Player, Team, ImportResult } from "../types";
import { teamName } from "./helpers";

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

function levenshtein(a: string, b: string): number {
  const m = a.length,
    n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function fuzzyTeamMatch(input: string, teamMap: Record<string, number>): number | null {
  const keys = Object.keys(teamMap);
  const lower = input.toLowerCase().replace(/[\s]+/g, "");
  let best = { key: null as string | null, dist: Infinity };
  for (const key of keys) {
    const normalized = key.replace(/[\s]+/g, "");
    if (normalized === lower) return teamMap[key];
    const dist = levenshtein(normalized, lower);
    if (dist < best.dist) best = { key, dist };
  }
  return best.dist <= 2 ? teamMap[best.key!] : null;
}

export function parseCSVPlayers(
  text: string,
  teams: Team[],
  existingPlayers: Player[]
): ImportResult {
  const cleaned = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const lines = cleaned
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) throw new Error("CSV file is empty or has no data rows.");

  const rawHeaders = parseCSVLine(lines[0]).map((h) => h.trim());
  const headers = rawHeaders.map((h) =>
    h.toLowerCase().replace(/[\s_-]+/g, "")
  );
  const nameIdx = headers.findIndex(
    (h) => h === "name" || h === "playername"
  );
  const teamIdx = headers.findIndex(
    (h) => h === "team" || h === "teamname"
  );
  const posIdx = headers.findIndex(
    (h) => h === "position" || h === "pos"
  );
  const numIdx = headers.findIndex(
    (h) => h === "number" || h === "jerseynumber" || h === "jersey" || h === "no"
  );
  const capIdx = headers.findIndex(
    (h) => h === "captain" || h === "iscaptain" || h === "c"
  );

  if (nameIdx === -1)
    throw new Error(
      `Missing required column "name" or "Player Name". Found: ${
        rawHeaders.join(", ") || "(empty header row)"
      }`
    );
  if (teamIdx === -1)
    throw new Error(
      `Missing required column "team" or "Team Name". Found: ${rawHeaders.join(", ")}`
    );

  const teamMap: Record<string, number> = {};
  teams.forEach((t) => {
    const key = t.name.trim().toLowerCase();
    if (key) teamMap[key] = t.id;
  });

  // Build duplicate lookup from existing players
  const existingByName = new Set<string>();
  const existingByNumber = new Set<string>();
  existingPlayers.forEach((p) => {
    existingByName.add(`${p.teamId}:${p.name.trim().toLowerCase()}`);
    existingByNumber.add(`${p.teamId}:${p.number}`);
  });

  const imported: Player[] = [];
  const errors: string[] = [];
  const validPositions = ["GK", "DEF", "MID", "ATT"];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    const name = (fields[nameIdx] || "").trim();
    const rowTeamName = (fields[teamIdx] || "").trim();

    if (!name) {
      errors.push(`Row ${i + 1}: name is empty`);
      continue;
    }
    if (!rowTeamName) {
      errors.push(`Row ${i + 1} ("${name}"): team is empty`);
      continue;
    }

    let teamId: number | null = teamMap[rowTeamName.toLowerCase()] ?? null;
    if (!teamId) teamId = fuzzyTeamMatch(rowTeamName, teamMap);
    if (!teamId) {
      const available =
        Object.keys(teamMap).length > 0
          ? Object.keys(teamMap).join(", ")
          : "(teams have no names set yet)";
      errors.push(
        `Row ${i + 1} ("${name}"): team "${rowTeamName}" not found. Available: ${available}`
      );
      continue;
    }

    const rawPosition = posIdx !== -1 ? (fields[posIdx] || "").trim() : "";
    const positionMap: Record<string, string> = {
      goalkeeper: "GK",
      "goal keeper": "GK",
      gk: "GK",
      goalie: "GK",
      defender: "DEF",
      def: "DEF",
      midfielder: "MID",
      mid: "MID",
      midfield: "MID",
      attacker: "ATT",
      att: "ATT",
      forward: "ATT",
      striker: "ATT",
      fw: "ATT",
    };
    const position =
      positionMap[rawPosition.toLowerCase()] ||
      (validPositions.includes(rawPosition.toUpperCase())
        ? rawPosition.toUpperCase()
        : "MID");
    const number =
      numIdx !== -1 ? Number.parseInt(fields[numIdx], 10) : 1;
    const captain =
      capIdx !== -1
        ? /^(yes|true|1|y)$/i.test((fields[capIdx] || "").trim())
        : false;
    if (!Number.isFinite(number) || number < 1 || number > 99) {
      errors.push(`Row ${i + 1} ("${name}"): jersey number must be between 1 and 99`);
      continue;
    }

    const nameKey = `${teamId}:${name.toLowerCase()}`;
    if (existingByName.has(nameKey)) {
      errors.push(
        `Row ${i + 1} ("${name}"): duplicate player — ${teamName(teamId, teams)} already has a player named "${name}".`
      );
      continue;
    }

    const numberKey = `${teamId}:${number}`;
    if (existingByNumber.has(numberKey)) {
      errors.push(
        `Row ${i + 1} ("${name}"): duplicate jersey number — ${teamName(teamId, teams)} already has #${number}.`
      );
      continue;
    }

    existingByName.add(nameKey);
    existingByNumber.add(numberKey);

    imported.push({
      id: Date.now() + i,
      teamId,
      name,
      position: position as Player["position"],
      number,
      goals: 0,
      assists: 0,
      ownGoals: 0,
      yellowCards: 0,
      redCards: 0,
      saves: 0,
      penaltySaves: 0,
      cleanSheets: 0,
      motm: 0,
      tackles: 0,
      interceptions: 0,
      blocks: 0,
      aerialDuelsWon: 0,
      errorsLeadingToGoal: 0,
      penaltiesConceded: 0,
      goalsConceded: 0,
      matchWins: 0,
      bonus5Saves: 0,
      captain,
      rating: 6.0,
      matchRatings: {},
    });
  }

  return { imported, errors };
}
