import type { Match, MatchEvent, Player } from "./types";
import { useAppStore } from "./store";

/**
 * The single seam through which every match-day write flows.
 *
 * The quick add-event modal, the live card and the phone-first match mode all
 * call these helpers, so the store mutation, the API call and the undo path
 * only exist once. When an offline queue is added later, it wraps
 * `submitMatchEvent` and friends here — nothing else needs to change.
 */

/** Starts a fixture (sets it live). Throws when the API rejects the start. */
export async function startMatch(matchId: number): Promise<void> {
  const res = await fetch(`/api/fixtures/${matchId}/start`, { method: "POST" });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || "Unable to start the match.");
  const startedAt: string = body?.fixture?.live_started_at ?? new Date().toISOString();
  const store = useAppStore.getState();
  store.updateMatch(matchId, "status", "live");
  store.updateMatch(matchId, "live_started_at", startedAt);
}

/** Marks a fixture completed with the given final score. */
export async function finishMatch(
  matchId: number,
  homeScore: number,
  awayScore: number
): Promise<void> {
  const res = await fetch(`/api/fixtures/${matchId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ homeScore, awayScore, status: "completed" }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "Unable to finish the match.");
  }
  const store = useAppStore.getState();
  store.updateMatch(matchId, "homeScore", homeScore);
  store.updateMatch(matchId, "awayScore", awayScore);
  store.updateMatch(matchId, "status", "completed");
  store.recalculateRatings();
}

/** Maps an event type to the denormalized player-stat column it increments. */
export const EVENT_STAT_FIELD: Record<string, keyof Player> = {
  goal: "goals",
  assist: "assists",
  "own-goal": "ownGoals",
  yellow: "yellowCards",
  red: "redCards",
  save: "saves",
  "penalty-save": "penaltySaves",
  "clean-sheet": "cleanSheets",
  motm: "motm",
  error: "errorsLeadingToGoal",
  "penalty-conceded": "penaltiesConceded",
  tackle: "tackles",
  interception: "interceptions",
  block: "blocks",
  aerial: "aerialDuelsWon",
  "goal-conceded": "goalsConceded",
  "match-win": "matchWins",
  "bonus-5-saves": "bonus5Saves",
};

/** Score delta produced by a goal/own-goal for the scoring team. */
export function computeEventScore(
  match: Match,
  playerTeamId: number,
  eventType: string
): { homeScore: number | null; awayScore: number | null } {
  const home = match.homeScore ?? 0;
  const away = match.awayScore ?? 0;

  if (eventType === "goal") {
    if (playerTeamId === match.homeId) return { homeScore: home + 1, awayScore: away };
    return { homeScore: home, awayScore: away + 1 };
  }
  if (eventType === "own-goal") {
    if (playerTeamId === match.homeId) return { homeScore: home, awayScore: away + 1 };
    return { homeScore: home + 1, awayScore: away };
  }
  return { homeScore: match.homeScore, awayScore: match.awayScore };
}

function persistScore(matchId: number, home: number | null | undefined, away: number | null | undefined) {
  return fetch(`/api/fixtures/${matchId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ homeScore: home ?? 0, awayScore: away ?? 0 }),
  }).catch(() => {
    // persist silently
  });
}

export interface SubmitMatchEventInput {
  match: Match;
  playerId: number | null;
  teamId: number;
  type: string;
  minute?: number;
  /** Called after the server confirms the write (for cache invalidation). */
  onSettled?: () => void;
}

export interface SubmittedMatchEvent {
  /** Server id of the created event, when available. */
  serverId: number | null;
  /** Reverts the optimistic update and removes the event server-side. */
  undo: () => void;
}

/**
 * Adds a match event: optimistically updates the store, persists the event and
 * (for goals) the score, and returns a bound undo. Throws when the write fails
 * so the caller can surface an error.
 */
export async function submitMatchEvent(input: SubmitMatchEventInput): Promise<SubmittedMatchEvent> {
  const { match, playerId, teamId, type, minute, onSettled } = input;
  const store = useAppStore.getState();

  const player = playerId == null ? undefined : store.players.find((p) => p.id === playerId);
  const newEvent: MatchEvent = { playerId, type, teamId, minute };
  const prevHome = match.homeScore;
  const prevAway = match.awayScore;

  const events = [...(match.events || []), newEvent];
  store.updateMatch(match.id, "events", events);

  const score = computeEventScore(match, teamId, type);
  store.updateMatch(match.id, "homeScore", score.homeScore);
  store.updateMatch(match.id, "awayScore", score.awayScore);

  if (player && playerId != null) {
    const field = EVENT_STAT_FIELD[type];
    if (field) {
      store.updatePlayer(playerId, { [field]: ((player[field] as number) || 0) + 1 });
    }
  }
  store.recalculateRatings();

  let serverId: number | null = null;

  const undo = () => {
    const fresh = useAppStore.getState();
    let targetEvents: MatchEvent[] = events;
    for (const round of fresh.fixtures) {
      const found = round.matches.find((m) => m.id === match.id);
      if (found) {
        targetEvents = found.events || [];
        break;
      }
    }
    const list = [...targetEvents];
    const field = EVENT_STAT_FIELD[type];
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      if (e.playerId === playerId && e.type === type && e.teamId === teamId) {
        list.splice(i, 1);
        break;
      }
    }
    fresh.updateMatch(match.id, "events", list);

    const current = playerId == null ? undefined : fresh.players.find((p) => p.id === playerId);
    if (current && field) {
      fresh.updatePlayer(playerId!, {
        [field]: Math.max(0, ((current[field] as number) || 0) - 1),
      });
    }
    fresh.updateMatch(match.id, "homeScore", prevHome);
    fresh.updateMatch(match.id, "awayScore", prevAway);
    if (type !== "goal" || !serverId) persistScore(match.id, prevHome, prevAway);
    fresh.recalculateRatings();

    if (serverId) {
      fetch(`/api/events/${serverId}`, { method: "DELETE" })
        .then(() => onSettled?.())
        .catch(() => {
          // persist silently
        });
    } else {
      onSettled?.();
    }
  };

  const eventSave = fetch(`/api/fixtures/${match.id}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, teamId, type, minute }),
  }).then(async (res) => {
    if (!res.ok) throw new Error("Match event save failed");
    const payload = await res.json().catch(() => null);
    if (payload?.scoreline) {
      const fresh = useAppStore.getState();
      fresh.updateMatch(match.id, "homeScore", payload.scoreline.homeScore);
      fresh.updateMatch(match.id, "awayScore", payload.scoreline.awayScore);
    }
    return (payload?.event?.id as number | undefined) ?? null;
  });

  const scoreSave =
    type === "own-goal"
      ? fetch(`/api/fixtures/${match.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            homeScore: score.homeScore ?? 0,
            awayScore: score.awayScore ?? 0,
          }),
        }).then((res) => {
          if (!res.ok) throw new Error("Match score save failed");
          return res;
        })
      : Promise.resolve(null);

  const [id] = await Promise.all([eventSave, scoreSave]);
  serverId = id;
  if (serverId) {
    const fresh = useAppStore.getState();
    for (const round of fresh.fixtures) {
      const currentMatch = round.matches.find((item) => item.id === match.id);
      const eventIndex = currentMatch?.events?.findIndex((event) => event === newEvent) ?? -1;
      if (currentMatch && eventIndex >= 0) {
        fresh.updateMatch(match.id, "events", currentMatch.events!.map((event, index) =>
          index === eventIndex ? { ...event, id: serverId } : event
        ));
        break;
      }
    }
  }
  onSettled?.();

  return { serverId, undo };
}

export interface RemoveMatchEventInput {
  match: Match;
  index: number;
  onSettled?: () => void;
}

export interface RemovedMatchEvent {
  /** Restores the event, score and player stat locally and on the server. */
  undo: () => void;
  /** Fires the deferred server-side delete. */
  persistDelete: () => void;
}

/**
 * Removes a match event optimistically. The caller shows an undo toast and
 * calls `persistDelete` after the grace window (unless the user taps undo).
 */
export function removeMatchEvent(input: RemoveMatchEventInput): RemovedMatchEvent | null {
  const { match, index, onSettled } = input;
  const store = useAppStore.getState();
  const events = match.events || [];
  const event = events[index];
  if (!event) return null;

  const updatedEvents = events.filter((_, i) => i !== index);
  const prevHome = match.homeScore;
  const prevAway = match.awayScore;

  const field = EVENT_STAT_FIELD[event.type];
  const player = event.playerId == null ? undefined : store.players.find((p) => p.id === event.playerId);
  const prevStatValue = player && field ? ((player[field] as number) || 0) : undefined;

  // Optimistic removal: hide the event and roll back score/stat locally.
  store.updateMatch(match.id, "events", updatedEvents);
  if (player && field && prevStatValue !== undefined) {
    store.updatePlayer(event.playerId!, { [field]: Math.max(0, prevStatValue - 1) });
  }
  let nextHome = prevHome;
  let nextAway = prevAway;
  if (event.type === "goal" || event.type === "own-goal") {
    const teamId = event.teamId ?? player?.teamId ?? match.homeId;
    const isOwnGoal = event.type === "own-goal";
    const scoringTeam = isOwnGoal
      ? teamId === match.homeId
        ? match.awayId
        : match.homeId
      : teamId;
    nextHome = scoringTeam === match.homeId ? Math.max(0, (prevHome ?? 0) - 1) : prevHome;
    nextAway = scoringTeam === match.awayId ? Math.max(0, (prevAway ?? 0) - 1) : prevAway;
    store.updateMatch(match.id, "homeScore", nextHome);
    store.updateMatch(match.id, "awayScore", nextAway);
    if (event.type !== "goal" || !event.id) persistScore(match.id, nextHome, nextAway);
  }
  store.recalculateRatings();

  const undo = () => {
    const fresh = useAppStore.getState();
    fresh.updateMatch(match.id, "events", events);
    if (player && field && prevStatValue !== undefined) {
      fresh.updatePlayer(event.playerId!, { [field]: prevStatValue });
    }
    if (event.type === "goal" || event.type === "own-goal") {
      fresh.updateMatch(match.id, "homeScore", prevHome);
      fresh.updateMatch(match.id, "awayScore", prevAway);
      if (event.type !== "goal" || !event.id) persistScore(match.id, prevHome, prevAway);
    }
    fresh.recalculateRatings();
  };

  const persistDelete = () => {
    fetch(event.id ? `/api/events/${event.id}` : `/api/events/0?match_id=${match.id}&player_id=${event.playerId}&type=${event.type}`, { method: "DELETE" })
      .then(() => onSettled?.())
      .catch(() => {
        // persist silently
      });
  };

  return { undo, persistDelete };
}
