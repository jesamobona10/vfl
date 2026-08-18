# Security Deployment Notes

## Secrets

- Keep `SUPABASE_SERVICE_ROLE_KEY` only in server-side deployment environment variables.
- Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` may be exposed to the browser.
- Do not commit `.env`, `.env.local`, database URLs, service-role keys, OAuth secrets, or API tokens.

## Supabase Auth

- Supabase Auth hashes user passwords. Do not store plaintext passwords in application tables or return them from API routes.
- Configure short-lived access tokens in Supabase Auth settings. Recommended starting point: 1 hour access token expiry with refresh token rotation enabled.
- Configure password recovery links in Supabase Auth so reset and magic-link tokens expire quickly. Recommended starting point: 15 to 30 minutes.
- Disable public signups unless `/api/auth/admin-signup` is intentionally being used for first-admin bootstrap.

## Database

- Keep Row Level Security enabled on every table.
- Apply the hardening block in `supabase/migration.sql` to restrict player, fixture, match event, notification, lineup, admin, and team-account access by role and ownership.
- Do not expose direct Postgres credentials from the frontend. If your Supabase plan supports network restrictions, limit direct database access to trusted deployment and admin IP ranges.
- Use the service-role key only in server route handlers that first verify admin authorization.

## Abuse Protection

- Application middleware rate-limits auth routes, authenticated API routes, and public live-score endpoints.
- Login, admin signup, and team-account creation have stricter per-IP or per-user limits.
- Put the app behind a production edge/WAF rate limit for distributed abuse, since in-memory limits are per Node.js instance.

## Transport And Headers

- Serve production traffic over HTTPS only.
- Production middleware redirects HTTP to HTTPS when `x-forwarded-proto` is not `https`.
- Security headers are applied in both middleware and `next.config.mjs`.

## Monitoring

- Authentication attempts, blocked access, rate-limit hits, and API failures are logged as structured JSON.
- Route these logs to your host's log drain or SIEM and alert on repeated login failures, 403 spikes, 429 spikes, and unexpected 500s.
