import { createClient } from "@supabase/supabase-js";

const [command, orgSlug] = process.argv.slice(2);

if (!command || !orgSlug) {
  console.error("Usage: npx tsx scripts/manage-org-fixtures.ts [list|delete] <org-slug>");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL in environment.");
  process.exit(1);
}

const sb = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function getOrgId() {
  const { data: org, error } = await sb
    .from("organizations")
    .select("id, name")
    .eq("slug", orgSlug)
    .single();

  if (error || !org) {
    console.error(`Organization with slug "${orgSlug}" not found.`);
    process.exit(1);
  }
  return org;
}

async function getTeamIds(orgId: string) {
  const { data: teams } = await sb
    .from("teams")
    .select("id, name")
    .eq("organization_id", orgId);

  return teams || [];
}

async function listFixtures(orgId: string) {
  const teams = await getTeamIds(orgId);
  if (!teams.length) {
    console.log("No teams found for this organization.");
    return;
  }

  const teamIds = teams.map((t) => t.id);
  const conditions = teamIds.map((id) => `home_team_id.eq.${id},away_team_id.eq.${id}`).join(",");

  const { data: fixtures, error } = await sb
    .from("fixtures")
    .select("id, round, home_team_id, away_team_id, home_score, away_score, status, competition_id, date")
    .or(conditions)
    .order("round")
    .order("id");

  if (error) {
    console.error("Error fetching fixtures:", error.message);
    return;
  }

  if (!fixtures || !fixtures.length) {
    console.log("No fixtures found for this organization.");
    return;
  }

  const teamMap = new Map(teams.map((t) => [t.id, t.name]));

  console.log(`\n=== Fixtures for org "${orgSlug}" (${teams.length} teams, ${fixtures.length} matches) ===\n`);

  for (const f of fixtures) {
    const home = teamMap.get(f.home_team_id) || `Team ${f.home_team_id}`;
    const away = teamMap.get(f.away_team_id) || `Team ${f.away_team_id}`;
    const score = f.home_score != null ? `${f.home_score} - ${f.away_score}` : "TBD";
    console.log(
      `  #${f.id}  R${f.round}  ${home.padEnd(20)} vs ${away.padEnd(20)}  [${score}]  ${f.status}  ${f.date || ""}`
    );
  }

  return fixtures;
}

async function deleteFixtures(orgId: string) {
  const fixtures = await listFixtures(orgId);
  if (!fixtures || !fixtures.length) return;

  console.log(`\nAbout to delete ALL ${fixtures.length} fixtures above.`);

  const fixtureIds = fixtures.map((f) => f.id);

  const { error: eventsError } = await sb
    .from("match_events")
    .delete()
    .in("match_id", fixtureIds);
  if (eventsError) {
    console.error("Error deleting match events:", eventsError.message);
  }

  const { error } = await sb.from("fixtures").delete().in("id", fixtureIds);
  if (error) {
    console.error("Error deleting fixtures:", error.message);
    process.exit(1);
  }

  console.log(`\nDeleted ${fixtures.length} fixtures (and their events).`);
}

const org = await getOrgId();

if (command === "list") {
  await listFixtures(org.id);
} else if (command === "delete") {
  console.log(`\nWARNING: This will delete ALL fixtures for "${org.name}" (${orgSlug}).`);
  console.log("This cannot be undone.");
  if (process.env.CONFIRM_DELETE !== "yes") {
    console.error("\nTo confirm, run with CONFIRM_DELETE=yes:");
    console.error(`  CONFIRM_DELETE=yes npx tsx scripts/manage-org-fixtures.ts delete ${orgSlug}`);
    process.exit(1);
  }
  await deleteFixtures(org.id);
} else {
  console.error(`Unknown command: "${command}". Use "list" or "delete".`);
  process.exit(1);
}
