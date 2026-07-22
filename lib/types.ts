export interface Team {
  id: number;
  name: string;
  logo_url?: string;
  rating: number;
  organization_id?: string;
  points?: number;
  played?: number;
  won?: number;
  drawn?: number;
  lost?: number;
  gf?: number;
  ga?: number;
  gd?: number;
  form?: string;
}

export interface LineupSlot {
  slotId: string;
  label: string;
  position: "GK" | "DEF" | "MID" | "ATT";
  playerId: number | null;
}

export interface TeamLineup {
  id: number;
  teamId: number;
  name: string;
  formation: string;
  slots: LineupSlot[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MatchEvent {
  playerId: number;
  type: string;
  minute?: number;
}

export interface Match {
  id: number;
  round: number;
  home_team_id?: number;
  away_team_id?: number;
  homeId: number;
  awayId: number;
  homeScore: number | null;
  awayScore: number | null;
  status: "scheduled" | "in-progress" | "completed" | "live";
  date: string;
  time: string;
  venue: string;
  events: MatchEvent[];
  manualEdited?: boolean;
  autoAdjusted?: boolean;
}

export interface FixtureRound {
  round: number;
  byeId: number | null;
  matches: Match[];
}

export interface Player {
  id: number;
  teamId: number;
  name: string;
  position: "GK" | "DEF" | "MID" | "ATT";
  number: number;
  goals: number;
  assists: number;
  ownGoals: number;
  yellowCards: number;
  redCards: number;
  saves: number;
  penaltySaves: number;
  cleanSheets: number;
  motm: number;
  tackles: number;
  interceptions: number;
  blocks: number;
  aerialDuelsWon: number;
  errorsLeadingToGoal: number;
  penaltiesConceded: number;
  goalsConceded: number;
  matchWins: number;
  bonus5Saves: number;
  captain: boolean;
  rating: number;
  matchRatings: Record<string, number>;
}

export interface TeamAccount {
  id: string;
  teamId: number;
  name: string;
  role: "coach" | "captain";
  username: string;
  password: string;
}

export interface UserProfile {
  id: string;
  role: "super_admin" | "team_account" | "player" | "org_admin";
  displayName?: string;
  teamId?: number | null;
  username?: string;
  playerId?: number | null;
  orgRole?: string;
  orgSlug?: string | null;
  org?: { id: string; name: string; slug: string; type: string };
}

export interface StandingRow {
  id: number;
  name: string;
  rating: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  form: string;
}

export interface LeagueStats {
  goals: number;
  goalsPerMatch: string;
  biggestWin: string;
  highestRound: string;
}

export interface VerifyResult {
  valid: boolean;
  errors: string[];
}

export interface RepairResult {
  ok: boolean;
  changed?: number;
  reason?: string;
}

export interface ImportResult {
  imported: Player[];
  errors: string[];
}

export interface NewMatchInput {
  homeId: number;
  awayId: number;
  round?: number;
  date?: string;
  time?: string;
  venue?: string;
}

export type CupRound = "playoff" | "quarter" | "semi" | "final";
export type CompletedVia = "regular" | "extra_time" | "penalties";

export interface CupMatch {
  id: number;
  round: CupRound;
  matchIndex: number;
  homeId: number | null;
  awayId: number | null;
  homeFromMatchId?: number;
  awayFromMatchId?: number;
  homeScore: number | null;
  awayScore: number | null;
  homeETScore: number | null;
  awayETScore: number | null;
  homePenScore: number | null;
  awayPenScore: number | null;
  status: "scheduled" | "completed";
  winnerId: number | null;
  completedVia: CompletedVia | null;
  date: string;
  time: string;
  venue: string;
  playoffPairing?: string;
}

export type OrgType = "school" | "academy" | "club";
export type OrgRole = "owner" | "admin" | "coach" | "player";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  type: OrgType;
  logo_url?: string;
  settings?: Record<string, unknown>;
  created_at: string;
}

export interface OrgMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
}

export type CompetitionType = "league" | "cup" | "friendly";
export type CompetitionStatus = "draft" | "active" | "completed";

export interface Competition {
  id: string;
  organization_id: string;
  name: string;
  type: CompetitionType;
  season: string | null;
  status: CompetitionStatus;
  settings: Record<string, unknown>;
  logo_url?: string;
  created_at: string;
  created_by: string | null;
}

export type SeasonStatus = "upcoming" | "active" | "completed";

export interface Season {
  id: string;
  competition_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: SeasonStatus;
  is_current: boolean;
  created_at: string;
}

export interface CupState {
  matches: CupMatch[];
  champion: number | null;
  playoffsGenerated: boolean;
  bracketGenerated: boolean;
}
