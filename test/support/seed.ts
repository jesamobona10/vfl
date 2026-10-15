import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  COMPETITION_A,
  EMAILS,
  EVENT_A,
  FIXTURE_A,
  FIXTURE_B,
  ORG_A,
  ORG_B,
  PASSWORD,
  PLAYER_A1,
  PLAYER_A2,
  PLAYER_B1,
  SEASON_A,
  TEAM_A1,
  TEAM_A2,
  TEAM_B1,
  TEAM_B2,
} from "./authz";

function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env for authz seed.");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function ensureUser(admin: SupabaseClient, email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (!error && data.user) return data.user.id;

  const { data: list, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listError) throw new Error(`listUsers failed: ${listError.message}`);
  const found = list.users.find((user) => user.email === email);
  if (!found) throw new Error(`could not create or find user ${email}: ${error?.message}`);
  return found.id;
}

/**
 * Seed a small, deterministic, multi-tenant workspace:
 *
 *   org A: teams A1/A2, a fixture, a season + competition, an org owner,
 *          an org "player" member, and a team-account coach of A1.
 *   org B: team B1/B2 and a team-account coach of B1 (the "other" tenant).
 *
 * Idempotent: fixed ids are deleted before insertion.
 */
export async function seedAuthzData(): Promise<void> {
  const admin = serviceClient();

  const [superId, orgAdminAId, orgPlayerAId, coachAId, coachBId] = await Promise.all([
    ensureUser(admin, EMAILS.superAdmin),
    ensureUser(admin, EMAILS.orgAdminA),
    ensureUser(admin, EMAILS.orgPlayerA),
    ensureUser(admin, EMAILS.coachA),
    ensureUser(admin, EMAILS.coachB),
  ]);

  // Clean any prior run. Deleting the orgs cascades teams, players, fixtures,
  // events, competitions, seasons, memberships and team accounts.
  const cleanup = await admin
    .from("organizations")
    .delete()
    .in("id", [ORG_A, ORG_B]);
  if (cleanup.error) throw new Error(`cleanup organizations: ${cleanup.error.message}`);

  const cleanupAdmins = await admin.from("admin_users").delete().in("id", [superId, orgAdminAId]);
  if (cleanupAdmins.error) throw new Error(`cleanup admin_users: ${cleanupAdmins.error.message}`);

  const orgs = await admin.from("organizations").insert([
    { id: ORG_A, name: "Authz Org A", slug: "authz-org-a", type: "club" },
    { id: ORG_B, name: "Authz Org B", slug: "authz-org-b", type: "club" },
  ]);
  if (orgs.error) throw new Error(`insert organizations: ${orgs.error.message}`);

  const teams = await admin.from("teams").insert([
    { id: TEAM_A1, name: "Authz Team A1", organization_id: ORG_A },
    { id: TEAM_A2, name: "Authz Team A2", organization_id: ORG_A },
    { id: TEAM_B1, name: "Authz Team B1", organization_id: ORG_B },
    { id: TEAM_B2, name: "Authz Team B2", organization_id: ORG_B },
  ]);
  if (teams.error) throw new Error(`insert teams: ${teams.error.message}`);

  const players = await admin.from("players").insert([
    { id: PLAYER_A1, team_id: TEAM_A1, name: "Authz Player A1", position: "GK" },
    { id: PLAYER_A2, team_id: TEAM_A2, name: "Authz Player A2", position: "DF" },
    { id: PLAYER_B1, team_id: TEAM_B1, name: "Authz Player B1", position: "FW" },
  ]);
  if (players.error) throw new Error(`insert players: ${players.error.message}`);

  const competitions = await admin.from("competitions").insert([
    { id: COMPETITION_A, organization_id: ORG_A, name: "Authz Cup A", type: "league", status: "active" },
  ]);
  if (competitions.error) throw new Error(`insert competitions: ${competitions.error.message}`);

  const seasons = await admin.from("seasons").insert([
    { id: SEASON_A, competition_id: COMPETITION_A, name: "2025/26", status: "active", is_current: true },
  ]);
  if (seasons.error) throw new Error(`insert seasons: ${seasons.error.message}`);

  const fixtures = await admin.from("fixtures").insert([
    {
      id: FIXTURE_A,
      round: 1,
      home_team_id: TEAM_A1,
      away_team_id: TEAM_A2,
      competition_id: COMPETITION_A,
      season_id: SEASON_A,
      status: "scheduled",
    },
    {
      id: FIXTURE_B,
      round: 1,
      home_team_id: TEAM_B1,
      away_team_id: TEAM_B2,
      status: "scheduled",
    },
  ]);
  if (fixtures.error) throw new Error(`insert fixtures: ${fixtures.error.message}`);

  const events = await admin.from("match_events").insert([
    {
      id: EVENT_A,
      match_id: FIXTURE_A,
      player_id: PLAYER_A1,
      team_id: TEAM_A1,
      event_type: "goal",
      minute: 10,
    },
  ]);
  if (events.error) throw new Error(`insert match_events: ${events.error.message}`);

  const adminUsers = await admin
    .from("admin_users")
    .insert([{ id: superId, email: EMAILS.superAdmin }]);
  if (adminUsers.error) throw new Error(`insert admin_users: ${adminUsers.error.message}`);

  const members = await admin.from("organization_members").insert([
    { organization_id: ORG_A, user_id: orgAdminAId, role: "owner" },
    { organization_id: ORG_A, user_id: orgPlayerAId, role: "player" },
    { organization_id: ORG_A, user_id: coachAId, role: "coach" },
    { organization_id: ORG_B, user_id: coachBId, role: "coach" },
  ]);
  if (members.error) throw new Error(`insert organization_members: ${members.error.message}`);

  const accounts = await admin.from("team_accounts").insert([
    {
      id: coachAId,
      username: "authz-coach-a",
      display_name: "Authz Coach A",
      team_id: TEAM_A1,
      organization_id: ORG_A,
    },
    {
      id: coachBId,
      username: "authz-coach-b",
      display_name: "Authz Coach B",
      team_id: TEAM_B1,
      organization_id: ORG_B,
    },
  ]);
  if (accounts.error) throw new Error(`insert team_accounts: ${accounts.error.message}`);
}
