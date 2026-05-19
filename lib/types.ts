export interface Team {
  id: number;
  name: string;
  logo?: string;
  rating: number;
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
  role: "super_admin" | "team_account";
  displayName?: string;
  teamId?: number | null;
  username?: string;
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
