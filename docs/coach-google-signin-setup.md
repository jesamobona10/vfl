# Coach Google Sign-In — Setup & Verification Runbook

Operational steps for the coach invite/claim flow implemented in
`docs/coach-google-auth-implementation-guide.md` Phases 1–3a.

Order matters: the migration must land before anything can be claimed, and the
Google/Supabase OAuth wiring must land before any coach can sign in. Do all of
it against **staging** first and walk a real coach through it end to end before
touching production — that walkthrough is the gate the guide sets for Phase 4.

---

## Prerequisites

- Supabase project (staging) with CLI or SQL Editor access.
- Google Cloud project you can create OAuth credentials in.
- The deployment domain you will allowlist (e.g. `https://staging.example.com`).
- Repo at a commit that includes `supabase/migrations/20261004_team_account_invites.sql`.

---

## Part 1 — Apply the migration

`supabase/migrations/20261004_team_account_invites.sql` is **not** included in
`supabase/migration.sql` (that file is the original bootstrap only, and is
already out of date). Apply the dated migration.

Option A — Supabase SQL Editor: open the file, paste, Run.

Option B — CLI:

```bash
npx supabase db push --db-url "$STAGING_DB_URL"
```

### Verify

```sql
-- Table exists
select table_name from information_schema.tables
 where table_name = 'team_account_invites';

-- Indexes (expect 3: pending_unique, pending_email, org)
select indexname from pg_indexes where tablename = 'team_account_invites';

-- RLS enabled
select relrowsecurity, relforcerowsecurity
  from pg_class where relname = 'team_account_invites';

-- Claim function exists and is restricted to authenticated
select proname, prosecdef, proconfig
  from pg_proc where proname = 'claim_team_account_invite';
```

`prosecdef` must be `t` and `proconfig` must contain `search_path=`. If either
is wrong, the function will either fail to insert (no RLS bypass) or be
reached with a hijackable `search_path`.

---

## Part 2 — Google Cloud Console

1. Open <https://console.cloud.google.com/apis/credentials> and pick/create a project.
2. **OAuth consent screen** → External.
   - Add your coach accounts under **Test users**. Until the app is published
     this is the only way anyone can sign in; a non-test user sees
     "Google hasn't verified this app" and cannot proceed.
3. **Create credentials → OAuth client ID → Web application**.
   - Name it anything, e.g. `LeagueForge Supabase`.
   - **Authorized redirect URI** (this exact value):
     ```
     https://<project-ref>.supabase.co/auth/v1/callback
     ```
     `<project-ref>` is in your Supabase project URL
     (`https://<project-ref>.supabase.co`).
   - **Authorized JavaScript origins** is not required — Supabase performs the
     code exchange server-side.
4. Copy the **Client ID** and **Client secret**.

---

## Part 3 — Supabase Auth configuration

### Enable the provider

**Authentication → Providers → Google**: enable, then paste the Client ID and
Client secret from Part 2.

### Allowlist the callback

**Authentication → URL Configuration**:

| Field         | Value                                     |
| ------------- | ----------------------------------------- |
| Site URL      | `https://<your-domain>`                   |
| Redirect URLs | add `https://<your-domain>/auth/callback` |

The callback is `app/auth/callback/route.ts`, which exchanges the PKCE code for
a session and then redirects to `next` (default `/`).

---

## Part 4 — Environment

The invite APIs use the service-role client, so this key is required — without
it those routes fail rather than degrading.

| Variable                        | Required    | Notes                                          |
| ------------------------------- | ----------- | ---------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | yes         | project URL                                    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes         | anon key                                       |
| `SUPABASE_SERVICE_ROLE_KEY`     | yes         | invite list/create/revoke, `/api/team/invites` |
| `NEXT_PUBLIC_APP_URL`           | recommended | canonical origin, used to build recovery links |

Apply the migration, then deploy. Redeploy after changing any `NEXT_PUBLIC_*`
value — they are inlined at build time.

See `.env.example` for the full list, including the optional keys and what
happens when each is absent.

**Without the three Supabase values the app does not degrade — it throws on
every request.** They are read with a non-null assertion (`process.env.X!`), so
a missing value reaches the SDK as `undefined` and `createServerClient` raises
_"Your project's URL and Key are required to create a Supabase client!"_ The
proxy fails the same way, so pages and API routes break alike.

`app/auth/callback/route.ts` catches that throw and redirects to `/auth/login`,
which makes a misconfigured environment look like _"Google sign-in did nothing"_
rather than surfacing an error. Check `.env.local` first when that happens.

---

## Part 5 — Create an invite

**Org admin path:** `/org/<slug>/team-accounts` → _Invite from CSV_.

CSV columns are `email,team` (required) and `role` (optional).

- `email` — also accepts `e-mail`, `email address`, `coach email`
- `team` — also accepts `team name`, `which team`, `club`
- `role` — also accepts `position`, `job title`, `title`. Values are matched
  case-insensitively: `coach`, `head`, `headcoach`, `head coach`, `manager` →
  coach; `assistant`, `assistant_coach`, `assistant coach`, `asst`,
  `asstcoach` → assistant coach. Note `manager` maps to **coach**, not to
  assistant. An unrecognised value is a per-row error, not a silent default.

Omit `role` to get `coach`.

```csv
email,team,role
coach@example.com,Northside Rovers,coach
assistant@example.com,Northside Rovers,assistant_coach
```

Team names must resolve inside that organization — unmatched rows are rejected
and reported per row rather than creating orphaned invites.

**SQL path (useful for a first smoke test):**

```sql
insert into team_account_invites (email, organization_id, team_id, role, created_by)
select 'coach@example.com', t.organization_id, t.id, 'coach', auth.uid()
  from teams t
  join organizations o on o.id = t.organization_id
 where t.name = 'Northside Rovers'
   and o.slug = '<your-org-slug>';
```

Note `auth.uid()` is NULL in the SQL Editor, so this path leaves `created_by`
NULL. That column is nullable, so the insert succeeds — but use the UI path
when you want the invite to record which admin created it.

---

## Part 6 — Walk the flow

1. Sign in to the app as an **org admin**, open _Team Accounts_, and confirm the
   invite shows as _Awaiting sign-in_.
2. In a **private/incognito window** (so you are not carrying the admin
   session), go to `/auth/login` → **Team** tab → **Sign in with Google**.
3. Sign in with the invited address. Expect to land on
   `/org/<slug>/dashboard` with a sidebar containing Dashboard, Standings,
   Players, Fixtures, Team Settings, Public Match Centre.
4. Confirm the invite now reads _Claimed_.

### Verify in the database

```sql
-- A team_accounts row was created for the Google user, with the org populated
select id, username, display_name, team_id, organization_id, role
  from team_accounts
 where username = 'coach@example.com';

-- The invite is consumed, not deleted
select email, claimed_at is not null as claimed
  from team_account_invites where email = 'coach@example.com';
```

`organization_id` **must** be non-null. A null there means the coach cannot
resolve their org slug, so the entry redirect never fires and the proxy bounces
them off `/org/*`.

---

## Part 7 — Troubleshooting

### The code lands on the home page instead of the callback

Symptom: the address bar shows `http://localhost:3000/?code=f4a14b79-...`

Supabase rejected the requested redirect and fell back to the **Site URL**, so
the PKCE code arrived on `/` instead of `/auth/callback`. Fix the allowlist:
ensure `http://localhost:3000/auth/callback` is listed under
**Authentication → URL Configuration → Redirect URLs**, and that Site URL
matches the origin you are actually browsing from (`localhost` and `127.0.0.1`
are different origins, and a port mismatch counts).

Since `proxy.ts` now forwards any `?code=` to the callback, this self-heals at
runtime — but only if the dev server is actually running, and the underlying
allowlist entry is still wrong and should be corrected.

A code can only be redeemed once. After fixing the allowlist, start the Google
flow again from scratch rather than reloading the stale URL.

### "This site can't be reached" on localhost:3000

Nothing is listening on the port. Check before debugging anything else:

```bash
ss -ltnp | grep -E '3000|8080'
```

`npm run dev` serves 3000; `npm start` serves **8080** (the start script pins
`PORT:-8080`). A Google redirect pointing at 8080 will fail if you only ever
ran `npm run dev`.

### Signed in, but no dashboard / no sidebar

The coach has no org slug, so `app-shell.tsx` has nothing to redirect to.

```sql
-- Look the row up by email. Do NOT use `where id = auth.uid()` here: this
-- query runs in the SQL Editor with no signed-in user, so auth.uid() is NULL
-- and the query silently returns zero rows — which looks identical to
-- "the row is missing" and sends you chasing the wrong problem.
-- The claim stores username = left(email, 64), so match with LIKE rather than
-- equality: a >64-character address is truncated and an equality check would
-- miss the row.
select id, username, team_id, organization_id
  from team_accounts
 where username ilike 'coach@example.com%';
```

If `organization_id` is null, the row predates the org backfill. Fix it from
the team, never by hand-picking a value:

```sql
update team_accounts ta
   set organization_id = t.organization_id
  from teams t
 where ta.team_id = t.id and ta.organization_id is null;
```

### Claim silently does nothing

`claim_team_account_invite` returns zero rows in several ordinary cases. Check
in this order:

```sql
-- 1. Is the address on the invite exactly the verified address? (case-insensitive)
select email, claimed_by, claimed_at from team_account_invites where lower(email) = lower('coach@example.com');

-- 2. Does the auth user have a confirmed email? An unconfirmed address is
--    refused on purpose, so someone cannot claim an invite by registering an
--    unverified address that happens to match.
select email, email_confirmed_at from auth.users where email = 'coach@example.com';
```

### 403 on the Fixtures page

`app/api/organizations/[slug]/fixtures` compares the org on the coach's own
`team_accounts` row. Null there means the same fix as above. Note the `teams`
RLS policy admits only org members and super admins, so a coach cannot read
their own team through the anon client — that is expected, not a bug.

### "relation does not exist" during claim

The migration's claim function was not applied, or was applied from a version
with unqualified table names. `supabase/migrations/20261004_team_account_invites.sql`
schema-qualifies every table because the function sets `search_path = ''`.
`lib/migration-security-audit.test.ts` fails if that is ever undone.

---

## Known behaviours (not bugs)

- **A returning user who already has a session never reaches the callback.**
  `proxy.ts` redirects any signed-in visitor off `/auth/*`. They land on `/`,
  where the claim still runs during server-side session resolution, so the
  outcome is the same — but the code exchange is skipped.
- **An existing player who is invited is promoted to a team account.** The claim
  runs before the player branch of `resolveSession`, so the invited address
  becomes a `team_account` rather than staying a `player`. This is intended
  (the invite was created deliberately by an org admin), but it does change
  which role that person lands in.
- **Coaches see no Fixture edit/table/generate controls.** Those stay behind
  `isAdmin`; `OrgSeasonProvider` only loads read data for team accounts.
