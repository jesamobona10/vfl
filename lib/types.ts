/**
 * Core type definitions for the LeagueForge (VFL) application.
 *
 * This module defines all shared TypeScript interfaces and types used
 * across the frontend store, API routes, and database layer.
 *
 * @module types
 */

// ─── Team & Player Types ──────────────────────────────────────────────────────

/** Represents a football team with optional standings data. */
export interface Team {
  /** Unique numeric identifier. */
  id: number;
  /** Display name of the team. */
  name: string;
  /** Optional URL to the team's logo image. */
  logo_url?: string;
  /** ELO-style rating used for seeding and seeding display. */
  rating: number;
  /** The organization this team belongs to (null for legacy/top-level teams). */
  organization_id?: string;
  /** Points accumulated in the current standings context. */
  points?: number;
  /** Total matches played. */
  played?: number;
  /** Matches won. */
  won?: number;
  /** Matches drawn. */
  drawn?: number;
  /** Matches lost. */
  lost?: number;
  /** Goals for. */
  gf?: number;
  /** Goals against. */
  ga?: number;
  /** Goal difference (gf - ga). */
  gd?: number;
  /** Recent form string (e.g. "WWDLW"). */
  form?: string;
}

/** A single position slot in a team lineup formation. */
export interface LineupSlot {
  /** Unique identifier for this slot (e.g. "GK", "DEF-1"). */
  slotId: string;
  /** Human-readable label for the slot. */
  label: string;
  /** Football position category. */
  position: "GK" | "DEF" | "MID" | "ATT";
  /** ID of the player assigned to this slot, or null if empty. */
  playerId: number | null;
}

/** A saved team lineup/formation configuration. */
export interface TeamLineup {
  /** Unique lineup identifier. */
  id: number;
  /** The team this lineup belongs to. */
  teamId: number;
  /** User-given name for this lineup (e.g. "4-3-3 Default"). */
  name: string;
  /** Formation string (e.g. "4-3-3", "4-4-2"). */
  formation: string;
  /** Ordered list of lineup slots. */
  slots: LineupSlot[];
  /** Whether this lineup is currently active for the team. */
  isActive: boolean;
  /** ISO 8601 timestamp when the lineup was created. */
  createdAt: string;
  /** ISO 8601 timestamp when the lineup was last updated. */
  updatedAt: string;
}

/** A single event that occurred during a match (goal, card, save, etc.). */
export interface MatchEvent {
  /** ID of the player involved. */
  playerId: number;
  /** Event type (e.g. "goal", "yellow_card", "save", "own_goal"). */
  type: string;
  /** Minute of the match when the event occurred. */
  minute?: number;
  /** ID of the team the player belongs to. */
  teamId?: number;
}

// ─── Match & Fixture Types ────────────────────────────────────────────────────

/** A single match/fixture between two teams. */
export interface Match {
  /** Unique match identifier. */
  id: number;
  /** Round number in the fixture schedule. */
  round: number;
  /** Database ID of the home team (nullable for legacy data). */
  home_team_id?: number;
  /** Database ID of the away team (nullable for legacy data). */
  away_team_id?: number;
  /** Normalized home team ID. */
  homeId: number;
  /** Normalized away team ID. */
  awayId: number;
  /** Home team score, or null if not yet played. */
  homeScore: number | null;
  /** Away team score, or null if not yet played. */
  awayScore: number | null;
  /** Current match status. */
  status: "scheduled" | "in-progress" | "completed" | "live";
  /** Match date in "YYYY-MM-DD" format. */
  date: string;
  /** Match time in "HH:MM" or "HH:MM AM/PM" format. */
  time: string;
  /** Venue/stadium name. */
  venue: string;
  /** List of match events (goals, cards, saves, etc.). */
  events: MatchEvent[];
  /** Whether the match was manually edited by an admin. */
  manualEdited?: boolean;
  /** Whether team assignments were auto-adjusted during repair. */
  autoAdjusted?: boolean;
  /** ID of the competition this match belongs to. */
  competition_id?: string | null;
  /** ID of the season this match belongs to. */
  season_id?: string | null;
  /** ISO 8601 timestamp when the match went live. */
  live_started_at?: string | null;
}

/** A single round of fixtures containing multiple matches. */
export interface FixtureRound {
  /** Round number. */
  round: number;
  /** ID of the team with a bye this round (null if none). */
  byeId: number | null;
  /** Matches scheduled for this round. */
  matches: Match[];
}

// ─── Player Types ─────────────────────────────────────────────────────────────

/** A player with full statistics profile. */
export interface Player {
  /** Unique numeric identifier. */
  id: number;
  /** ID of the team the player belongs to. */
  teamId: number;
  /** Full name of the player. */
  name: string;
  /** Primary position. */
  position: "GK" | "DEF" | "MID" | "ATT";
  /** Jersey/shirt number. */
  number: number;
  /** Total goals scored. */
  goals: number;
  /** Total assists. */
  assists: number;
  /** Total own goals. */
  ownGoals: number;
  /** Total yellow cards received. */
  yellowCards: number;
  /** Total red cards received. */
  redCards: number;
  /** Total saves (GK only). */
  saves: number;
  /** Penalty saves (GK only). */
  penaltySaves: number;
  /** Clean sheets kept (GK/DEF). */
  cleanSheets: number;
  /** Man of the match awards. */
  motm: number;
  /** Total tackles. */
  tackles: number;
  /** Total interceptions. */
  interceptions: number;
  /** Total blocks. */
  blocks: number;
  /** Aerial duels won. */
  aerialDuelsWon: number;
  /** Errors directly leading to a goal. */
  errorsLeadingToGoal: number;
  /** Penalties conceded. */
  penaltiesConceded: number;
  /** Goals conceded (GK/DEF). */
  goalsConceded: number;
  /** Matches where the player's team won while they were on the pitch. */
  matchWins: number;
  /** Bonus points for 5+ saves in a single match. */
  bonus5Saves: number;
  /** Whether the player is a team captain. */
  captain: boolean;
  /** Computed overall rating (0-10 scale). */
  rating: number;
  /** Per-match rating history keyed by match ID. */
  matchRatings: Record<string, number>;
  /** Timestamp when player was anonymized (PII removed). */
  anonymized_at?: string;
  /** User ID who performed anonymization. */
  anonymized_by?: string;
  /** Original name before anonymization (for audit). */
  original_name?: string;
}

/** A team account (login credentials for team coaches/captains). */
export interface TeamAccount {
  /** Account UUID. */
  id: string;
  /** ID of the team this account manages. */
  teamId: number;
  /** Display name for the account. */
  name: string;
  /** Role of the account holder. */
  role: "coach" | "captain";
  /** Login username. */
  username: string;
  /** Password (only populated during creation; never stored in state). */
  password: string;
}

// ─── Auth & User Types ────────────────────────────────────────────────────────

/** User profile resolved from session data. */
export interface UserProfile {
  /** User UUID from Supabase Auth. */
  id: string;
  /** Resolved role for this user. */
  role: "super_admin" | "team_account" | "player" | "org_admin";
  /** Display name (typically email or username). */
  displayName?: string;
  /** Team ID if the user is a team account. */
  teamId?: number | null;
  /** Username if the user is a team account or player. */
  username?: string;
  /** Player ID if the user is a player account. */
  playerId?: number | null;
  /** Organization role if the user is an org member. */
  orgRole?: string;
  /** Organization slug if the user is an org member. */
  orgSlug?: string | null;
  /** Organization details if resolved. */
  org?: { id: string; name: string; slug: string; type: string };
}

// ─── Standings & Statistics Types ─────────────────────────────────────────────

/** A single row in the league standings table. */
export interface StandingRow {
  /** Team ID. */
  id: number;
  /** Team name. */
  name: number extends never ? string : string;
  /** Team rating. */
  rating: number;
  /** Matches played. */
  played: number;
  /** Matches won. */
  won: number;
  /** Matches drawn. */
  drawn: number;
  /** Matches lost. */
  lost: number;
  /** Goals for. */
  gf: number;
  /** Goals against. */
  ga: number;
  /** Goal difference. */
  gd: number;
  /** Points (3 for win, 1 for draw, 0 for loss). */
  points: number;
  /** Recent form string. */
  form: string;
}

/** Aggregated league-level statistics. */
export interface LeagueStats {
  /** Total goals scored across all matches. */
  goals: number;
  /** Average goals per match (formatted string). */
  goalsPerMatch: string;
  /** Largest winning margin description (e.g. "Team A 5-0 Team B"). */
  biggestWin: string;
  /** Highest round played so far. */
  highestRound: string;
}

// ─── Validation & Result Types ────────────────────────────────────────────────

/** Result of a fixture verification check. */
export interface VerifyResult {
  /** Whether all fixtures are valid. */
  valid: boolean;
  /** List of validation error messages. */
  errors: string[];
}

/** Result of a fixture repair operation. */
export interface RepairResult {
  /** Whether the repair succeeded. */
  ok: boolean;
  /** Number of matches modified during repair. */
  changed?: number;
  /** Human-readable reason if repair failed or had issues. */
  reason?: string;
}

/** Result of a CSV player import operation. */
export interface ImportResult {
  /** Players successfully imported. */
  imported: Player[];
  /** Error messages for rows that failed to import. */
  errors: string[];
}

/** A single parsed row from a player CSV import. */
export interface PlayerImportRow {
  /** Team name from the CSV. */
  team_name: string;
  /** Whether the team already exists in the system. */
  team_exists: boolean;
  /** Player name. */
  name: string;
  /** Player position. */
  position: string;
  /** Jersey number (null if not provided). */
  jersey_number: number | null;
  /** Whether the player is marked as captain. */
  is_captain: boolean;
}

/** Full result of parsing a player import CSV. */
export interface PlayerImportResult {
  /** Parsed rows with validation metadata. */
  rows: PlayerImportRow[];
  /** Error messages for unrecoverable issues. */
  errors: string[];
  /** Non-fatal warnings (e.g. duplicate players). */
  warnings: string[];
  /** Which expected headers were found in the CSV. */
  headersFound: { name: boolean; team: boolean };
}

/** Input for creating a new manual match/fixture. */
export interface NewMatchInput {
  /** Home team ID. */
  homeId: number;
  /** Away team ID. */
  awayId: number;
  /** Round number (auto-assigned if not provided). */
  round?: number;
  /** Match date. */
  date?: string;
  /** Match time. */
  time?: string;
  /** Match venue. */
  venue?: string;
}

// ─── Cup/Bracket Types ────────────────────────────────────────────────────────

/** A round in a cup/bracket competition. */
export type CupRound = "playoff" | "quarter" | "semi" | "final";

/** How a cup match was decided (regular time, extra time, or penalties). */
export type CompletedVia = "regular" | "extra_time" | "penalties";

/** A single match in a cup/bracket competition. */
export interface CupMatch {
  /** Unique match identifier. */
  id: number;
  /** Bracket round this match belongs to. */
  round: CupRound;
  /** Position index within the round. */
  matchIndex: number;
  /** Home team ID (null if TBD from a previous round). */
  homeId: number | null;
  /** Away team ID (null if TBD from a previous round). */
  awayId: number | null;
  /** ID of the match whose winner feeds into the home slot. */
  homeFromMatchId?: number;
  /** ID of the match whose winner feeds into the away slot. */
  awayFromMatchId?: number;
  /** Home team score at full time. */
  homeScore: number | null;
  /** Away team score at full time. */
  awayScore: number | null;
  /** Home team score after extra time. */
  homeETScore: number | null;
  /** Away team score after extra time. */
  awayETScore: number | null;
  /** Home team penalty shootout score. */
  homePenScore: number | null;
  /** Away team penalty shootout score. */
  awayPenScore: number | null;
  /** Match status. */
  status: "scheduled" | "completed";
  /** Winning team ID (null if not yet decided). */
  winnerId: number | null;
  /** How the winner was decided. */
  completedVia: CompletedVia | null;
  /** Match date. */
  date: string;
  /** Match time. */
  time: string;
  /** Match venue. */
  venue: string;
  /** Label for playoff grouping (e.g. "A vs B"). */
  playoffPairing?: string;
}

// ─── Organization & Multi-Tenant Types ────────────────────────────────────────

/** Type of organization (school, academy, or club). */
export type OrgType = "school" | "academy" | "club";

/** Role a user can have within an organization. */
export type OrgRole = "owner" | "admin" | "coach" | "player";

/** An organization (school, academy, or club) that manages teams and competitions. */
export interface Organization {
  /** Organization UUID. */
  id: string;
  /** Display name. */
  name: string;
  /** URL-safe slug used in routes (e.g. "/org/my-school"). */
  slug: string;
  /** Organization type. */
  type: OrgType;
  /** Optional logo URL. */
  logo_url?: string;
  /** JSON settings blob. */
  settings?: Record<string, unknown>;
  /** ISO 8601 creation timestamp. */
  created_at: string;
}

/** A user's membership in an organization. */
export interface OrgMember {
  /** Membership record UUID. */
  id: string;
  /** Organization UUID. */
  organization_id: string;
  /** User UUID. */
  user_id: string;
  /** Role within the organization. */
  role: OrgRole;
  /** ISO 8601 creation timestamp. */
  created_at: string;
}

// ─── Competition & Season Types ───────────────────────────────────────────────

/** The type of competition format. */
export type CompetitionType = "league" | "cup" | "friendly";

/** Lifecycle status of a competition. */
export type CompetitionStatus = "draft" | "active" | "completed" | "archived";

/** A competition (league, cup, or friendly) within an organization. */
export interface Competition {
  /** Competition UUID. */
  id: string;
  /** Owning organization UUID. */
  organization_id: string;
  /** Display name. */
  name: string;
  /** Competition format. */
  type: CompetitionType;
  /** Current lifecycle status. */
  status: CompetitionStatus;
  /** JSON settings blob. */
  settings: Record<string, unknown>;
  /** Optional logo URL. */
  logo_url?: string;
  /** ID of the currently active season, if any. */
  current_season_id?: string | null;
  /** ISO 8601 creation timestamp. */
  created_at: string;
  /** UUID of the user who created the competition. */
  created_by: string | null;
}

/** Lifecycle status of a season. */
export type SeasonStatus = "draft" | "upcoming" | "active" | "completed" | "archived";

/** A season within an organization (org-level season management). */
export interface OrganizationSeason {
  /** Season UUID. */
  id: string;
  /** Owning organization UUID. */
  organization_id: string;
  /** Display name (e.g. "2025-26 Season"). */
  name: string;
  /** Short display name. */
  short_name?: string | null;
  /** Season start date (ISO 8601 or null). */
  start_date: string | null;
  /** Season end date (ISO 8601 or null). */
  end_date: string | null;
  /** Current lifecycle status. */
  status: SeasonStatus;
  /** Whether this is the currently active season for the organization. */
  is_current: boolean;
  /** ISO 8601 creation timestamp. */
  created_at: string;
  /** ISO 8601 last-updated timestamp. */
  updated_at?: string | null;
}

/** A season within a competition. */
export interface Season {
  /** Season UUID. */
  id: string;
  /** Parent competition UUID. */
  competition_id: string;
  /** Display name. */
  name: string;
  /** Short display name. */
  short_name?: string | null;
  /** Season start date (ISO 8601 or null). */
  start_date: string | null;
  /** Season end date (ISO 8601 or null). */
  end_date: string | null;
  /** Current lifecycle status. */
  status: SeasonStatus;
  /** Whether this is the currently active season for the competition. */
  is_current: boolean;
  /** ISO 8601 creation timestamp. */
  created_at: string;
  /** ISO 8601 last-updated timestamp. */
  updated_at?: string | null;
}

/** A team's registration within a season. */
export interface SeasonTeam {
  /** Registration UUID. */
  id: string;
  /** Season UUID. */
  season_id: string;
  /** Team numeric ID. */
  team_id: number;
  /** Optional display name override for this season. */
  display_name?: string | null;
  /** Optional logo URL override for this season. */
  logo_url?: string | null;
  /** ISO 8601 registration timestamp. */
  registered_at: string;
  /** Registration status. */
  status: "active" | "inactive" | "withdrawn";
  /** ISO 8601 creation timestamp. */
  created_at: string;
  /** Resolved team details (when joined from the teams table). */
  team?: {
    id: number;
    name: string;
    logo_url?: string | null;
    rating?: number;
  } | null;
}

/** A player's registration within a season team. */
export interface SeasonTeamPlayer {
  /** Registration UUID. */
  id: string;
  /** Season team registration UUID. */
  season_team_id: string;
  /** Player numeric ID. */
  player_id: number;
  /** Jersey number for this season. */
  jersey_number?: number | null;
  /** Position for this season. */
  position?: string | null;
  /** ISO 8601 registration timestamp. */
  registered_at: string;
  /** Registration status. */
  status: "active" | "inactive" | "transferred";
  /** ISO 8601 creation timestamp. */
  created_at: string;
  /** Resolved player details (when joined from the players table). */
  player?: {
    id: number;
    name: string;
    position?: string | null;
    jersey_number?: number | null;
    photo_url?: string | null;
  } | null;
  /** Resolved season team details (when joined). */
  season_team?: {
    team_id: number;
    display_name?: string | null;
    team?: { id: number; name: string; logo_url?: string | null } | null;
  } | null;
}

/** Aggregated player statistics for a season. */
export interface SeasonPlayerStats {
  /** Player numeric ID. */
  player_id: number;
  /** Player name. */
  name: string;
  /** Team numeric ID. */
  team_id: number;
  /** Team name. */
  team_name: string;
  /** Goals scored. */
  goals: number;
  /** Assists. */
  assists: number;
  /** Yellow cards received. */
  yellow_cards: number;
  /** Red cards received. */
  red_cards: number;
  /** Matches played (appearances). */
  appearances: number;
}

// ─── Cup State ────────────────────────────────────────────────────────────────

/** Complete state of a cup/bracket competition. */
export interface CupState {
  /** All matches across all rounds. */
  matches: CupMatch[];
  /** Team ID of the champion (null if not yet determined). */
  champion: number | null;
  /** Whether the initial playoff round has been generated. */
  playoffsGenerated: boolean;
  /** Whether the knockout bracket has been generated. */
  bracketGenerated: boolean;
}

// ─── Database Row Types ───────────────────────────────────────────────────────

/**
 * Raw database row types matching Supabase table schemas.
 * Used for type-safe query results instead of `any`.
 */

/** Raw row from the `fixtures` table. */
export interface FixtureRow {
  id: number;
  round: number;
  home_team_id: number;
  away_team_id: number;
  home_score: number | null;
  away_score: number | null;
  status: string;
  date: string | null;
  time: string | null;
  venue: string | null;
  competition_id: string | null;
  season_id: string | null;
  live_started_at: string | null;
  created_at: string;
}

/** Raw row from the `match_events` table. */
export interface MatchEventRow {
  id: number;
  fixture_id: number;
  player_id: number;
  event_type: string;
  team_id: number | null;
  minute: number | null;
  created_at: string;
}

/** Raw row from the `teams` table. */
export interface TeamRow {
  id: number;
  name: string;
  logo_url: string | null;
  rating: number;
  organization_id: string | null;
  created_at: string;
}

/** Raw row from the `players` table. */
export interface PlayerRow {
  id: number;
  team_id: number;
  name: string;
  position: string;
  jersey_number: number;
  goals: number;
  assists: number;
  own_goals: number;
  yellow_cards: number;
  red_cards: number;
  saves: number;
  penalty_saves: number;
  clean_sheets: number;
  motm: number;
  tackles: number;
  interceptions: number;
  blocks: number;
  aerial_duels_won: number;
  errors_leading_to_goal: number;
  penalties_conceded: number;
  goals_conceded: number;
  match_wins: number;
  bonus_5_saves: number;
  captain: boolean;
  rating: number;
  match_ratings: Record<string, number>;
  created_at: string;
}

/** Raw row from the `admin_users` table. */
export interface AdminUserRow {
  id: string;
  email: string;
  created_at: string;
}

/** Raw row from the `team_accounts` table. */
export interface TeamAccountRow {
  id: string;
  username: string;
  display_name: string;
  team_id: number | null;
  role: string;
  created_at: string;
  teams?: { name: string } | null;
}

/** Raw row from the `player_profiles` table. */
export interface PlayerProfileRow {
  id: string;
  player_id: number;
  username: string;
  created_at: string;
}

/** Raw row from the `organizations` table. */
export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  type: string;
  logo_url: string | null;
  settings: Record<string, unknown> | null;
  created_at: string;
}

/** Raw row from the `organization_members` table. */
export interface OrgMemberRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  created_at: string;
  organizations?: { slug: string } | null;
}

/** Raw row from the `auth_audit_logs` table. */
export interface AuditLogRow {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  actor_role: string | null;
  action: string;
  event_type: string;
  resource_type: string | null;
  resource_id: string | null;
  description: string | null;
  before: unknown;
  after: unknown;
  metadata: Record<string, unknown>;
  success: boolean;
  category: string;
  severity: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}
