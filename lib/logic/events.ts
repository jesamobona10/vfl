/**
 * Canonical match-event vocabulary.
 *
 * Single source of truth for event types, their labels/abbreviations, which
 * events are "primary" (on the logger keypad) versus "secondary" (behind MORE),
 * and the score effect of a scoring event. The add-event modal, the events API
 * and the match logger all read from here so the list is never forked.
 *
 * @module logic/events
 */

export interface EventTypeDef {
  /** Stored `event_type` value. */
  value: string;
  /** Human label. */
  label: string;
  /** Short badge label. */
  abbr: string;
}

export interface EventCategory {
  label: string;
  types: EventTypeDef[];
}

/** All event types, grouped for the "more events" picker. */
export const EVENT_CATEGORIES: EventCategory[] = [
  {
    label: "Scoring",
    types: [
      { value: "goal", label: "Goal", abbr: "G" },
      { value: "assist", label: "Assist", abbr: "A" },
      { value: "own-goal", label: "Own Goal", abbr: "OG" },
      { value: "penalty-save", label: "Penalty Save", abbr: "PS" },
    ],
  },
  {
    label: "Discipline",
    types: [
      { value: "yellow", label: "Yellow Card", abbr: "Y" },
      { value: "red", label: "Red Card", abbr: "R" },
    ],
  },
  {
    label: "Goalkeeping",
    types: [
      { value: "save", label: "Save", abbr: "SV" },
      { value: "clean-sheet", label: "Clean Sheet", abbr: "CS" },
      { value: "goal-conceded", label: "Goal Conceded", abbr: "GC" },
      { value: "bonus-5-saves", label: "5+ Saves", abbr: "5+S" },
    ],
  },
  {
    label: "Performance",
    types: [
      { value: "motm", label: "Man of the Match", abbr: "MOTM" },
      { value: "match-win", label: "Match Win", abbr: "W" },
      { value: "error", label: "Error Leading to Goal", abbr: "ERR" },
      { value: "penalty-conceded", label: "Penalty Conceded", abbr: "PC" },
    ],
  },
  {
    label: "Defensive",
    types: [
      { value: "tackle", label: "Tackle", abbr: "T" },
      { value: "interception", label: "Interception", abbr: "INT" },
      { value: "block", label: "Block", abbr: "BLK" },
      { value: "aerial", label: "Aerial Duel Won", abbr: "AD" },
    ],
  },
];

/** Flat list of every valid event type value. */
export const ALL_EVENT_TYPES: string[] = EVENT_CATEGORIES.flatMap((c) =>
  c.types.map((t) => t.value)
);

/** The event types shown directly on the logger keypad. */
export const primaryEventTypes: string[] = ["goal", "assist", "yellow", "red", "own-goal"];

/** Everything else, surfaced behind the "MORE" key. */
export const secondaryEventTypes: string[] = ALL_EVENT_TYPES.filter(
  (type) => !primaryEventTypes.includes(type)
);

/** Event types that change the score (credited via {@link scoreDelta}). */
export const SCORING_EVENT_TYPES: string[] = ["goal", "own-goal"];

const EVENT_TYPE_BY_VALUE: Map<string, EventTypeDef> = new Map(
  EVENT_CATEGORIES.flatMap((c) => c.types).map((t) => [t.value, t])
);

/** Label for an event type, falling back to the raw value. */
export function eventTypeLabel(value: string): string {
  return EVENT_TYPE_BY_VALUE.get(value)?.label ?? value;
}

/** Short badge label for an event type, falling back to the raw value. */
export function eventTypeAbbr(value: string): string {
  return EVENT_TYPE_BY_VALUE.get(value)?.abbr ?? value.toUpperCase();
}

/** True when the event type is a valid, loggable event. */
export function isEventType(value: string): boolean {
  return EVENT_TYPE_BY_VALUE.has(value);
}

/**
 * Score effect of an event, as deltas for each side.
 *
 * A goal credits the scoring player's own team; an own goal credits the
 * opponent. Non-scoring events contribute nothing. `playerTeamId` is the team
 * of the player the event was logged against.
 */
export function scoreDelta(
  eventType: string,
  playerTeamId: number,
  homeTeamId: number,
  awayTeamId: number
): { home: number; away: number } {
  if (eventType === "goal") {
    if (playerTeamId === homeTeamId) return { home: 1, away: 0 };
    if (playerTeamId === awayTeamId) return { home: 0, away: 1 };
    return { home: 0, away: 0 };
  }
  if (eventType === "own-goal") {
    if (playerTeamId === homeTeamId) return { home: 0, away: 1 };
    if (playerTeamId === awayTeamId) return { home: 1, away: 0 };
    return { home: 0, away: 0 };
  }
  return { home: 0, away: 0 };
}
