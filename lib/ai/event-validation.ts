import type { ExtractionEventType, MatchContext } from "./llm-provider";

export interface ValidationWarning {
  code: string;
  message: string;
}

export interface ResolvedEvent {
  type: ExtractionEventType;
  minute: number | null;
  addedTime?: number | null;
  minuteInference?: { text: string; confidence: number; requiresReview: boolean } | null;
  playerId: number | null;
  playerName: string | null;
  playerStatus: "RESOLVED" | "AMBIGUOUS" | "NOT_FOUND";
  teamId: number | null;
  assistPlayerId: number | null;
  assistStatus?: "CLEAR" | "NONE" | "UNCLEAR";
  confidence: number;
  evidence: string;
  validation: {
    valid: boolean;
    errors: string[];
  };
}

export interface ValidationResult {
  events: ResolvedEvent[];
  warnings: ValidationWarning[];
  score: { homeScore: number | null; awayScore: number | null; inferred: boolean };
  scoreConflict: boolean;
}

const EVENT_TYPE_TO_EVENT_LABEL: Record<ExtractionEventType, string> = {
  GOAL: "goal",
  OWN_GOAL: "own-goal",
  PENALTY_GOAL: "goal",
  YELLOW_CARD: "yellow",
  RED_CARD: "red",
};

export function eventTypeToMatchEventType(type: ExtractionEventType): string {
  return EVENT_TYPE_TO_EVENT_LABEL[type] || type;
}

const ALLOWED_TYPES: ExtractionEventType[] = [
  "GOAL",
  "OWN_GOAL",
  "PENALTY_GOAL",
  "YELLOW_CARD",
  "RED_CARD",
];

const GOAL_TYPES: ExtractionEventType[] = ["GOAL", "OWN_GOAL", "PENALTY_GOAL"];

export interface CandidateEvent {
  type: ExtractionEventType;
  minute: number | null;
  addedTime?: number | null;
  minuteInference?: unknown;
  playerId?: number | null;
  playerName?: string | null;
  teamId?: number | null;
  assistPlayerId?: number | null;
  assistStatus?: "CLEAR" | "NONE" | "UNCLEAR";
  confidence?: number;
  evidence?: string;
  playerStatus?: "RESOLVED" | "AMBIGUOUS" | "NOT_FOUND";
}

/**
 * Deterministic validation of extracted/resolved events against business
 * rules. Never calls the LLM. Produces explicit errors and warnings.
 */
export function validateEvents(
  raw: CandidateEvent[],
  context: MatchContext,
  statedScore: { homeScore: number | null; awayScore: number | null } = {
    homeScore: null,
    awayScore: null,
  }
): ValidationResult {
  const homeId = context.homeTeam.id;
  const awayId = context.awayTeam.id;
  const warnings: ValidationWarning[] = [];
  const events: ResolvedEvent[] = [];
  const usedMinutes = new Map<string, number>(); // `type:playerId:teamId` → minute

  for (const rawEvent of raw) {
    const event: ResolvedEvent = {
      type: rawEvent.type,
      minute: rawEvent.minute ?? null,
      addedTime: rawEvent.addedTime ?? null,
      minuteInference:
        rawEvent.minuteInference && typeof rawEvent.minuteInference === "object"
          ? (rawEvent.minuteInference as ResolvedEvent["minuteInference"])
          : null,
      playerId: rawEvent.playerId ?? null,
      playerName: rawEvent.playerName ?? null,
      playerStatus: rawEvent.playerStatus || (rawEvent.playerId ? "RESOLVED" : "NOT_FOUND"),
      teamId: rawEvent.teamId ?? null,
      assistPlayerId: rawEvent.assistPlayerId ?? null,
      assistStatus: rawEvent.assistStatus || (rawEvent.assistPlayerId ? "CLEAR" : "NONE"),
      confidence: rawEvent.confidence ?? 0.5,
      evidence: rawEvent.evidence ?? "",
      validation: { valid: true, errors: [] },
    };

    const errors: string[] = [];

    // 1. Event type whitelist.
    if (!ALLOWED_TYPES.includes(event.type)) {
      errors.push("Unsupported event type.");
    }

    // 2. Minute validity.
    const minute = event.minute;
    if (minute != null) {
      const capped = (event.addedTime ?? 0) > 0 ? 130 : 110;
      if (minute < 0 || minute > capped) {
        errors.push(`Invalid match minute: ${minute}'`);
      } else if (event.addedTime != null && (event.addedTime < 0 || event.addedTime > 30)) {
        errors.push(`Invalid stoppage time: +${event.addedTime}'`);
      }
    } else if (!event.minuteInference) {
      warnings.push({
        code: "MINUTE_MISSING",
        message: `Missing minute for ${event.type} event${event.playerName ? ` (${event.playerName})` : ""}.`,
      });
    }

    // 3. Player resolution + team membership.
    if (event.playerStatus === "NOT_FOUND" && event.playerName) {
      warnings.push({
        code: "PLAYER_NOT_FOUND",
        message: `Player "${event.playerName}" was not found in the eligible roster.`,
      });
    } else if (event.playerStatus === "AMBIGUOUS") {
      warnings.push({
        code: "PLAYER_AMBIGUOUS",
        message: `Player reference for "${event.playerName || "unknown"}" is ambiguous — review required.`,
      });
    }

    if (event.teamId != null && event.teamId !== homeId && event.teamId !== awayId) {
      errors.push("Player/team does not belong to this match.");
    }

    // 4. Assist validity — only goals may carry an assist.
    if (event.assistPlayerId != null && !GOAL_TYPES.includes(event.type)) {
      errors.push("Assists are only valid on goal events.");
    }

    // 5. Duplicate detection against other extracted events.
    if (event.playerId != null && minute != null && event.type) {
      const key = `${event.type}:${event.playerId}:${event.teamId}`;
      const existing = usedMinutes.get(key);
      if (existing != null && Math.abs(existing - minute) <= 2) {
        warnings.push({
          code: "POSSIBLE_DUPLICATE",
          message: `Duplicate ${event.type} at ${minute}' for the same player (also at ${existing}').`,
        });
      } else {
        usedMinutes.set(key, minute);
      }
    }

    // 6. Duplicate detection against already-recorded match events.
    const existingDuplicate = context.existingEvents.some(
      (e) =>
        e.type.toLowerCase() === eventTypeToMatchEventType(event.type).toLowerCase() &&
        e.playerId === event.playerId &&
        e.minute != null &&
        minute != null &&
        Math.abs(e.minute - minute) <= 2 &&
        e.teamId === event.teamId
    );
    if (existingDuplicate) {
      warnings.push({
        code: "EXISTING_DUPLICATE",
        message: `Similar ${event.type} at ${minute}' already recorded for this player.`,
      });
    }

    event.validation = {
      valid: errors.length === 0,
      errors,
    };
    events.push(event);
  }

  const score = computeScore(events, context);
  const scoreConflict = detectScoreConflict(score, statedScore, events);

  if (scoreConflict) {
    warnings.push({
      code: "SCORE_CONFLICT",
      message:
        "The stated final score does not match the extracted goals — the FA must resolve it.",
    });
  }

  return {
    events,
    warnings,
    score,
    scoreConflict,
  };
}

/**
 * Compute expected home/away goals from extracted goal events.
 * Own goals increment the OPPOSITE team's total.
 */
export function computeScore(
  events: ResolvedEvent[],
  context: MatchContext
): { homeScore: number | null; awayScore: number | null; inferred: boolean } {
  const homeId = context.homeTeam.id;
  const awayId = context.awayTeam.id;
  let home = 0;
  let away = 0;
  let goals = 0;

  for (const ev of events) {
    if (ev.type === "GOAL" || ev.type === "PENALTY_GOAL") {
      if (ev.teamId === homeId) home += 1;
      else if (ev.teamId === awayId) away += 1;
      goals += 1;
    } else if (ev.type === "OWN_GOAL") {
      if (ev.teamId === homeId) away += 1;
      else if (ev.teamId === awayId) home += 1;
      goals += 1;
    }
  }

  const inferred = goals > 0;
  return {
    homeScore: inferred ? home : null,
    awayScore: inferred ? away : null,
    inferred,
  };
}

/**
 * True when the LLM-stated final score disagrees with the goals
 * extracted from the events. Only an inconsistency, never an override —
 * the FA resolves it.
 */
export function detectScoreConflict(
  computed: { homeScore: number | null; awayScore: number | null; inferred: boolean },
  stated: { homeScore: number | null; awayScore: number | null },
  events: ResolvedEvent[]
): boolean {
  const hasGoals = events.some((e) => GOAL_TYPES.includes(e.type));
  if (!hasGoals) return false;
  // If the LLM gave no final score, nothing to compare.
  if (stated.homeScore == null || stated.awayScore == null) return false;
  // If we couldn't infer a score from events, trust nothing (let FA decide).
  if (!computed.inferred) return false;
  return stated.homeScore !== computed.homeScore || stated.awayScore !== computed.awayScore;
}
