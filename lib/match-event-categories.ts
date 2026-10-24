export const MATCH_EVENT_CATEGORIES = [
  "Scoring",
  "Cards & discipline",
  "Goalkeeping",
  "Defending",
  "Other",
] as const;

export type MatchEventCategory = (typeof MATCH_EVENT_CATEGORIES)[number];

export function matchEventCategory(type: string): MatchEventCategory {
  const normalized = type.toLowerCase().replace(/_/g, "-");
  if (["goal", "own-goal", "assist", "motm", "match-win"].includes(normalized)) return "Scoring";
  if (["yellow", "yellow-card", "red", "red-card", "error", "penalty-conceded"].includes(normalized)) return "Cards & discipline";
  if (["save", "penalty-save", "clean-sheet", "goal-conceded", "bonus-5-saves"].includes(normalized)) return "Goalkeeping";
  if (["tackle", "interception", "block", "aerial"].includes(normalized)) return "Defending";
  return "Other";
}

export function matchEventCategoryColor(category: MatchEventCategory) {
  switch (category) {
    case "Scoring": return "bg-brand/10 text-brand";
    case "Cards & discipline": return "bg-warn-500/10 text-warn-500";
    case "Goalkeeping": return "bg-live-500/10 text-live-500";
    case "Defending": return "bg-accent/10 text-accent";
    default: return "bg-surface-2 text-ink-3";
  }
}
