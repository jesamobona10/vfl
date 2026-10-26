import type { Match } from "@/lib/types";

export type MatchdayView = "today" | "live" | "needs_action" | "upcoming" | "completed";

export function fixtureMatchesMatchdayView(match: Match, view: MatchdayView, today: string): boolean {
  const live = match.status === "live" || match.status === "in-progress";
  const needsAction = match.status === "scheduled" && (!match.date || !match.time || !match.venue);
  if (view === "today") return match.date === today;
  if (view === "live") return live;
  if (view === "needs_action") return needsAction;
  if (view === "upcoming") return match.status === "scheduled" && !needsAction && match.date >= today;
  return match.status === "completed";
}

export function getMatchdayViewCounts(matches: Match[], today: string): Record<MatchdayView, number> {
  const counts: Record<MatchdayView, number> = {
    today: 0,
    live: 0,
    needs_action: 0,
    upcoming: 0,
    completed: 0,
  };
  for (const match of matches) {
    for (const view of Object.keys(counts) as MatchdayView[]) {
      if (fixtureMatchesMatchdayView(match, view, today)) counts[view] += 1;
    }
  }
  return counts;
}
