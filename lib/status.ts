import type { BadgeVariant } from "@/components/ui/badge";

/**
 * Single source of truth for how lifecycle statuses map to badge variants and
 * labels, so a fixture (or season, or competition) looks identical everywhere
 * it appears. See docs/app-improvement-implementation-guide.md §2.2.
 */

/** Turn "in-progress" / "match_win" into "In Progress" / "Match Win". */
export function statusLabel(status: string): string {
  if (!status) return "";
  return status
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const MATCH_VARIANTS: Record<string, BadgeVariant> = {
  scheduled: "upcoming",
  upcoming: "upcoming",
  "in-progress": "live",
  live: "live",
  completed: "finished",
  finished: "finished",
  cancelled: "cancelled",
  canceled: "cancelled",
  postponed: "warn",
};

const COMPETITION_VARIANTS: Record<string, BadgeVariant> = {
  draft: "neutral",
  active: "brand",
  completed: "finished",
  archived: "neutral",
};

const SEASON_VARIANTS: Record<string, BadgeVariant> = {
  draft: "upcoming",
  upcoming: "upcoming",
  active: "live",
  completed: "finished",
  archived: "neutral",
};

export function matchStatusVariant(status: string): BadgeVariant {
  return MATCH_VARIANTS[status] ?? "neutral";
}

export function competitionStatusVariant(status: string): BadgeVariant {
  return COMPETITION_VARIANTS[status] ?? "neutral";
}

export function seasonStatusVariant(status: string): BadgeVariant {
  return SEASON_VARIANTS[status] ?? "neutral";
}
