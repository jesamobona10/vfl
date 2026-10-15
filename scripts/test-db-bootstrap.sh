#!/usr/bin/env bash
#
# Prepare a local Supabase stack for the API authorization tests.
#
# 1. Start the local Supabase containers (Docker required).
# 2. Create a fresh database from the legacy base schema (`migration.sql`)
#    followed by every file in `supabase/migrations/`, in filename order.
# 3. Write `.env.authz` with the connection details the tests need.
#
# This is intentionally destructive to the *local* database only. Never point
# `DB_URL` at a remote project.
#
# Usage: bash scripts/test-db-bootstrap.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if ! command -v psql >/dev/null 2>&1; then
  echo "error: psql not found. Install the PostgreSQL client (e.g. postgresql-client)." >&2
  exit 1
fi

if [ ! -f supabase/config.toml ]; then
  npx supabase init
fi

echo "==> Starting local Supabase (this pulls images on first run)"
# Start from a pristine database so `supabase start` lays down its own
# schema-wide grants and default privileges before we add our tables.
npx supabase stop --no-backup >/dev/null 2>&1 || true
npx supabase start

# Default env variable names emitted by `supabase status -o env`.
eval "$(npx supabase status -o env | sed 's/^/LIVE_/')"

API_URL="${LIVE_API_URL:?missing API_URL from supabase status}"
ANON_KEY="${LIVE_ANON_KEY:?missing ANON_KEY from supabase status}"
SERVICE_ROLE_KEY="${LIVE_SERVICE_ROLE_KEY:?missing SERVICE_ROLE_KEY from supabase status}"
DB_URL="${LIVE_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

echo "==> Applying legacy base schema (supabase/migration.sql)"
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f supabase/migration.sql

echo "==> Applying migrations"
for file in $(ls supabase/migrations/*.sql | sort); do
  echo "    - $(basename "$file")"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$file"
done

echo "==> Writing .env.authz"
cat > .env.authz <<EOF
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
AUTHZ_TESTS=1
EOF

echo "==> Done. Run tests with: set -a && source .env.authz && set +a && npm run test:authz"
