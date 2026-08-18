import type { MatchContextPlayer } from "./llm-provider";

export type ResolutionStatus = "RESOLVED" | "AMBIGUOUS" | "NOT_FOUND";

export interface ResolutionResult {
  status: ResolutionStatus;
  playerId: number | null;
  matchedName: string | null;
  confidence: number;
  candidates: MatchContextPlayer[];
  /** True when the report referenced someone not on the eligible list. */
  unlisted?: boolean;
}

const NAME_SEPARATORS = /[.\s\-']+/g;

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(NAME_SEPARATORS, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

/** Similarity 0-1 between two names using common-token + edit distance heuristics. */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const ta = na.split(" ");
  const tb = nb.split(" ");
  const common = ta.filter((t) => tb.includes(t)).length;
  const tokenScore = common / Math.max(ta.length, tb.length);

  // Substring containment (e.g. "Musa" inside "Samuel Peter Musa").
  const contains = na.includes(nb) || nb.includes(na);

  // Initial matching: "D. Musa" vs "Daniel Musa" → tokens ["d","musa"] vs ["daniel","musa"].
  const initMatch =
    ta.length >= 2 &&
    tb.length >= 2 &&
    ((ta[0].length === 1 && tb[0].startsWith(ta[0])) ||
      (tb[0].length === 1 && ta[0].startsWith(tb[0]))) &&
    ta.slice(1).join(" ") === tb.slice(1).join(" ");

  if (ta.length === 1 || tb.length === 1) {
    // Single-token reference: match against last-name or first-name presence.
    const single = ta.length === 1 ? ta[0] : tb[0];
    const full = normalizeName(ta.length === 1 ? na : na);
    const haystack = full.split(" ");
    if (haystack.includes(single)) return 0.92;
    if (haystack.some((h) => h.startsWith(single) || single.startsWith(h))) return 0.82;
    return 0;
  }

  if (initMatch) return 0.95;
  if (contains) return 0.96;

  return tokenScore;
}

/**
 * Resolve a report-referenced player name to the unique eligible player.
 * Constrained to the two participating teams' players only.
 */
export function resolvePlayer(
  name: string,
  eligiblePlayers: MatchContextPlayer[],
  jerseyNumber?: number | null
): ResolutionResult {
  const trimmed = (name || "").trim();
  if (!trimmed) {
    return {
      status: "NOT_FOUND",
      playerId: null,
      matchedName: null,
      confidence: 0,
      candidates: [],
    };
  }

  const scored = eligiblePlayers
    .map((p) => {
      let conf = nameSimilarity(trimmed, p.name);
      // Boost when a jersey number is explicitly given and matches.
      if (jerseyNumber != null && p.jerseyNumber === jerseyNumber) conf = Math.min(1, conf + 0.15);
      return { player: p, confidence: conf };
    })
    .sort((a, b) => b.confidence - a.confidence);

  const best = scored[0];
  const second = scored[1];

  if (!best)
    return {
      status: "NOT_FOUND",
      playerId: null,
      matchedName: null,
      confidence: 0,
      candidates: [],
      unlisted: true,
    };

  if (best.confidence >= 0.9) {
    // Pass if the top two are far apart (avoid two twins both being 0.92).
    const gap = best.confidence - (second?.confidence ?? 0);
    if (gap >= 0.12 || second === undefined || second.confidence < 0.9) {
      return {
        status: "RESOLVED",
        playerId: best.player.id,
        matchedName: best.player.name,
        confidence: best.confidence,
        candidates: scored.slice(0, 3).map((s) => s.player),
      };
    }
    return {
      status: "AMBIGUOUS",
      playerId: null,
      matchedName: null,
      confidence: best.confidence,
      candidates: scored.slice(0, 3).map((s) => s.player),
    };
  }

  if (best.confidence >= 0.5) {
    return {
      status: "AMBIGUOUS",
      playerId: null,
      matchedName: null,
      confidence: best.confidence,
      candidates: scored.slice(0, 3).map((s) => s.player),
    };
  }

  return {
    status: "NOT_FOUND",
    playerId: null,
    matchedName: null,
    confidence: best.confidence,
    candidates: scored.slice(0, 3).map((s) => s.player),
    unlisted: true,
  };
}

/** Determine the teamId for an event from the resolved player. */
export function teamForPlayer(
  playerId: number | null,
  eligiblePlayers: MatchContextPlayer[]
): number | null {
  if (playerId == null) return null;
  return eligiblePlayers.find((p) => p.id === playerId)?.teamId ?? null;
}
