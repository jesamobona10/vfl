import type { ExtractedEvent, ExtractionPayload, MatchContext } from "./llm-provider";
import { resolvePlayer, teamForPlayer } from "./entity-resolution";
import { validateEvents, type ResolvedEvent } from "./event-validation";

export interface AnalysisOutcome {
  events: ResolvedEvent[];
  warnings: Array<{ code: string; message: string }>;
  score: { homeScore: number | null; awayScore: number | null; inferred: boolean };
  scoreConflict: boolean;
  model: string;
  promptVersion: string;
  requiresReview: boolean;
}

/**
 * Combine an LLM extraction payload with deterministic entity resolution
 * and validation. Returns events with resolved player IDs and any
 * warnings the FA needs to review.
 */
export function processExtraction(
  payload: ExtractionPayload,
  context: MatchContext,
  model: string,
  promptVersion: string
): AnalysisOutcome {
  const resolved = payload.events.map((ev: ExtractedEvent) => {
    const resolution = resolvePlayer(ev.player.name, context.players, ev.player.jerseyNumber);

    const assistResolution =
      ev.assist && ev.assist.name
        ? resolvePlayer(ev.assist.name, context.players, ev.assist.jerseyNumber)
        : null;

    const playerId = resolution.status === "RESOLVED" ? resolution.playerId : null;
    const assistPlayerId =
      assistResolution?.status === "RESOLVED" ? assistResolution.playerId : null;

    return {
      type: ev.type,
      minute: ev.minute,
      addedTime: ev.addedTime ?? null,
      minuteInference: ev.minuteInference ?? null,
      playerId,
      playerName: ev.player.name,
      playerStatus: resolution.status,
      teamId: ev.unlisted ? null : teamForPlayer(playerId, context.players),
      assistPlayerId,
      assistPlayerName: assistResolution ? assistResolution.matchedName : (ev.assist?.name ?? null),
      assistStatus: ev.assistStatus ?? (assistResolution ? "CLEAR" : "NONE"),
      confidence: ev.confidence,
      evidence: ev.evidence,
      validation: { valid: true, errors: [] },
    };
  });

  const result = validateEvents(resolved as any, context, {
    homeScore: payload.homeScore,
    awayScore: payload.awayScore,
  });

  const reviewWarnings = result.warnings.filter(
    (w) =>
      w.code === "PLAYER_AMBIGUOUS" ||
      w.code === "PLAYER_NOT_FOUND" ||
      w.code === "SCORE_CONFLICT" ||
      w.code === "MINUTE_MISSING" ||
      w.code === "POSSIBLE_DUPLICATE" ||
      w.code === "EXISTING_DUPLICATE"
  );

  const inferredMinutes = result.events.some((e) => e.minute == null && e.minuteInference);
  const hasInvalid = result.events.some(
    (e) => !e.validation.valid || e.playerStatus !== "RESOLVED"
  );

  return {
    ...result,
    model,
    promptVersion,
    requiresReview: reviewWarnings.length > 0 || inferredMinutes || hasInvalid,
  };
}
