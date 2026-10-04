import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  asString,
  actorRole,
  getAuthContext,
  getClientIp,
  isValidEmail,
  json,
  logApiError,
  logSecurityEvent,
  parseJsonObject,
  rateLimit,
  rateLimitResponse,
  requireOrgAdmin,
  writeAuditRecord,
} from "@/lib/security";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";

export const dynamic = "force-dynamic";

const MAX_INVITE_ROWS = 500;
const BATCH_SIZE = 200;
const VALID_ROLES = ["coach", "assistant_coach"];

function levenshtein(a: string, b: string): number {
  const m = a.length,
    n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function fuzzyTeamMatch(input: string, teamMap: Map<string, number>): number | null {
  const lower = input.toLowerCase().replace(/\s+/g, "");
  let best = { key: null as string | null, dist: Infinity };
  for (const [key, id] of teamMap) {
    const normalized = key.replace(/\s+/g, "");
    if (normalized === lower) return id;
    const dist = levenshtein(normalized, lower);
    if (dist < best.dist) best = { key, dist };
  }
  return best.dist <= 2 ? teamMap.get(best.key!)! : null;
}

type PendingInvite = {
  email: string;
  teamId: number;
  role: string;
};

/**
 * List pending and claimed invites for an organization. Org admins only —
 * coaches read their own team's invites through /api/team/invites instead.
 */
export async function GET(_request: Request, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  try {
    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    if (!auth) return json({ error: "Unauthorized" }, { status: 401 });

    const sb = createServiceRoleClient();
    const { data: org } = await sb
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .single();

    if (!org) return json({ error: "Organization not found." }, { status: 404 });

    const adminError = requireOrgAdmin(auth, org.id);
    if (adminError) return adminError;

    const { data, error } = await sb
      .from("team_account_invites")
      .select("id, email, role, team_id, claimed_at, created_at, teams(name)")
      .eq("organization_id", org.id)
      .order("created_at", { ascending: false });

    if (error) {
      logApiError("org_team_invites_list_failed", error, { userId: auth!.userId });
      return json({ error: "Unable to load invites." }, { status: 500 });
    }

    return json({ invites: data || [] });
  } catch (error) {
    logApiError("org_team_invites_list_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

/**
 * Bulk-create invites. Rows are validated and team names resolved against the
 * organization before anything is written; anything unresolvable is reported
 * back per row rather than silently dropped, so a partially-wrong CSV is never
 * mistaken for a clean import.
 */
export async function POST(request: Request, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  try {
    const ip = getClientIp(request);
    const limited = await rateLimit({
      key: `team-invites:create:${ip}`,
      limit: 20,
      windowMs: 60 * 60_000,
    });
    if (limited.limited) {
      logSecurityEvent("team_invites_rate_limited", { ip });
      return rateLimitResponse(limited.resetAt);
    }

    const supabase = await createClient();
    const auth = await getAuthContext(supabase);
    if (!auth) return json({ error: "Unauthorized" }, { status: 401 });

    const sb = createServiceRoleClient();
    const { data: org } = await sb
      .from("organizations")
      .select("id, name")
      .eq("slug", slug)
      .single();

    if (!org) return json({ error: "Organization not found." }, { status: 404 });

    const adminError = requireOrgAdmin(auth, org.id);
    if (adminError) return adminError;

    const parsed = await parseJsonObject(request);
    if (parsed.error) return json({ error: parsed.error }, { status: 400 });

    const rowsRaw = parsed.data!.invites ?? parsed.data!.rows;
    if (!Array.isArray(rowsRaw)) {
      return json({ error: "invites must be an array." }, { status: 400 });
    }
    if (rowsRaw.length === 0) {
      return json({ error: "No invites to create." }, { status: 400 });
    }
    if (rowsRaw.length > MAX_INVITE_ROWS) {
      return json({ error: `Too many invites. Maximum is ${MAX_INVITE_ROWS}.` }, { status: 400 });
    }

    const { data: orgTeams } = await sb
      .from("teams")
      .select("id, name")
      .eq("organization_id", org.id)
      .order("id");

    const teamMap = new Map<string, number>();
    (orgTeams || []).forEach((t: any) => {
      const key = t.name.trim().toLowerCase();
      if (key) teamMap.set(key, t.id);
    });

    const pending: PendingInvite[] = [];
    const skipped: Array<{ email: string; reason: string }> = [];
    const errors: string[] = [];
    const batchEmails = new Set<string>();

    for (const [i, raw] of rowsRaw.entries()) {
      const rowNum = i + 2; // CSV row numbers (header = 1)
      const email = asString(raw?.email, 254)?.toLowerCase();
      const teamName = asString(raw?.team_name ?? raw?.teamName, 80);
      const roleRaw = asString(raw?.role, 32)?.toLowerCase() || "coach";

      if (!email || !isValidEmail(email)) {
        errors.push(`Row ${rowNum}: invalid or missing email`);
        continue;
      }
      if (!teamName) {
        errors.push(`Row ${rowNum} ("${email}"): team is empty`);
        continue;
      }
      if (!VALID_ROLES.includes(roleRaw)) {
        errors.push(`Row ${rowNum} ("${email}"): role must be coach or assistant_coach`);
        continue;
      }

      const teamId = teamMap.get(teamName.toLowerCase()) ?? fuzzyTeamMatch(teamName, teamMap);
      if (!teamId) {
        errors.push(`Row ${rowNum} ("${email}"): team "${teamName}" not found in your organization.`);
        continue;
      }

      if (batchEmails.has(email)) {
        skipped.push({ email, reason: "duplicate in upload" });
        continue;
      }
      batchEmails.add(email);

      pending.push({ email, teamId, role: roleRaw });
    }

    // Drop anyone already holding an unclaimed invite, or who already has team
    // access — re-inviting them would silently fail on the partial unique index
    // and read as a failure rather than a no-op.
    const candidateEmails = [...batchEmails];
    let existingPending = new Set<string>();
    let existingAccounts = new Set<string>();
    if (candidateEmails.length > 0) {
      const [{ data: alreadyPending }, { data: accountRows }] = await Promise.all([
        sb
          .from("team_account_invites")
          .select("email")
          .eq("organization_id", org.id)
          .is("claimed_by", null)
          .in("email", candidateEmails),
        sb
          .from("team_accounts")
          .select("username, teams!inner(organization_id)")
          .eq("teams.organization_id", org.id)
          .not("username", "is", null),
      ]);
      existingPending = new Set((alreadyPending || []).map((r: any) => String(r.email).toLowerCase()));
      // Google-claimed accounts carry their email as the username; legacy
      // credential accounts use the TEAMNAME-123 shape and are not matchable
      // by email, so only the email-shaped ones are checked here.
      existingAccounts = new Set(
        (accountRows || [])
          .map((r: any) => String(r.username || "").toLowerCase())
          .filter((u: string) => u.includes("@"))
      );
    }

    const insertable = pending.filter((row) => {
      if (existingPending.has(row.email)) {
        skipped.push({ email: row.email, reason: "already invited" });
        return false;
      }
      if (existingAccounts.has(row.email)) {
        skipped.push({ email: row.email, reason: "already has team access" });
        return false;
      }
      return true;
    });

    let created = 0;
    for (let i = 0; i < insertable.length; i += BATCH_SIZE) {
      const batch = insertable.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await sb.from("team_account_invites").insert(
        batch.map((row) => ({
          email: row.email,
          organization_id: org.id,
          team_id: row.teamId,
          role: row.role,
          created_by: auth!.userId,
        }))
      );

      if (insertError) {
        // Almost always a concurrent import claiming the same address. Re-read
        // to tell a lost race apart from a genuine write failure instead of
        // blaming the whole batch.
        const { data: raced } = await sb
          .from("team_account_invites")
          .select("email")
          .eq("organization_id", org.id)
          .is("claimed_by", null)
          .in(
            "email",
            batch.map((r) => r.email)
          );
        const racedEmails = new Set(
          (raced || []).map((r: any) => String(r.email).toLowerCase())
        );
        const conflicted = batch.filter((r) => racedEmails.has(r.email));
        const failed = batch.filter((r) => !racedEmails.has(r.email));

        for (const row of conflicted) {
          skipped.push({ email: row.email, reason: "already invited" });
        }
        for (const row of failed) {
          errors.push(`Could not invite "${row.email}".`);
        }
        if (failed.length > 0) {
          logApiError("org_team_invites_insert_failed", insertError, {
            userId: auth!.userId,
            organizationId: org.id,
          });
        }
        continue;
      }

      created += batch.length;
    }

    if (created > 0) {
      logSecurityEvent("org_team_invites_created", {
        ip,
        userId: auth!.userId,
        organizationId: org.id,
        created,
      });
      void writeAuditRecord({
        organizationId: org.id,
        actorId: auth!.userId,
        actorRole: actorRole(auth!),
        action: AUDIT_ACTIONS.USER_CREATED,
        resourceType: "TEAM_ACCOUNT_INVITE",
        description: `Created ${created} coach invite(s)`,
        after: { created, skipped: skipped.length },
        ip,
      }).catch(() => {});
    }

    return json({
      created,
      skipped,
      errors,
      summary: `${created} invite(s) created.`,
    });
  } catch (error) {
    logApiError("org_team_invites_create_error", error);
    return json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
