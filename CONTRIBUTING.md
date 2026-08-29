# Contributing to LeagueForge

Thank you for your interest in contributing to LeagueForge! This document outlines guidelines for contributing to the project.

## Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and fill in required values
4. Run database migrations in Supabase SQL Editor
5. Start development server: `npm run dev`

## Code Standards

- **TypeScript**: All code must be strictly typed. `npm run typecheck` must pass.
- **Linting**: Follow the ESLint configuration. `npm run lint` must pass with 0 errors.
- **Tests**: Write tests for new functionality. `npm run test` must pass.
- **Formatting**: Code is formatted with Prettier (configured in `package.json`).

## Security

- **Never commit secrets**: `.env`, `.env.local`, and any files containing API keys, database credentials, or service role keys must never be committed. Use `.env.example` for templates.
- **Input validation**: All server-side inputs must be validated. Use the utilities in `lib/security.ts` (`sanitizeText`, `asString`, `asInteger`, `asBoolean`, `parseJsonObject`).
- **Authorization**: Every API route must verify the caller's permissions using the helpers in `lib/security.ts`:
  - `requireAuth()` — authenticated user
  - `requireOrgAdmin(auth, orgId)` — org admin for write operations
  - `requireOrgMember(auth, orgId)` — org member for read operations
  - `ownsTeam(auth, teamId)` — team account ownership
- **RLS**: All tenant-owned tables must have Row Level Security policies with `organization_id` as the leading index column.
- **CSRF**: State-changing endpoints should implement CSRF protection (currently a known gap).

## IP & Asset Handling

**Critical**: This project handles user-uploaded branding assets (team logos, organization crests, flyer backgrounds). The following rules apply:

- **Organization-uploaded assets only**: Features that generate exports, flyers, or graphics must use only logos, crests, and branding uploaded by the organization itself.
- **No third-party logos**: Do not implement features that fetch or embed competition badges, sponsor marks, league logos, or other third-party branding from external sources unless explicitly provided by the organization.
- **User responsibility**: Organizations are responsible for ensuring they have rights to assets they upload. LeagueForge does not verify copyright ownership of uploaded assets.
- **Generated content**: When generating flyers, PDFs, or other exports, only include assets that were uploaded through the official upload endpoints.

## Database Migrations

- Migrations are idempotent (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
- Run migrations in Supabase SQL Editor.
- Include verification queries in each migration.
- RLS policy changes: use `DROP POLICY IF EXISTS` before `CREATE POLICY`.

## Commit Messages

Follow conventional commit format:
- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation changes
- `refactor:` — code restructuring
- `perf:` — performance improvements
- `security:` — security-related changes
- `test:` — test additions/changes

## Pull Requests

1. Create a feature branch from `main`
2. Ensure all checks pass (`typecheck`, `lint`, `test`, `build`)
3. Open PR with clear description of changes
4. Link related issues
5. Request review from maintainers

## Reporting Security Issues

Report security vulnerabilities privately to the maintainers — **do not open public issues** for security vulnerabilities.

## License

By contributing, you agree that your contributions will be licensed under the MIT License (see `LICENSE`).