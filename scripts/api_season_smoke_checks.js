// Simple smoke-check script for season APIs. Requires an AUTH_TOKEN env var
// Usage: AUTH_TOKEN=... NODE_ENV=development node scripts/api_season_smoke_checks.js

const BASE = process.env.BASE_URL || 'http://localhost:8080';
const AUTH = process.env.AUTH_TOKEN || '';

async function run() {
  if (!AUTH) {
    console.error('Set AUTH_TOKEN environment variable for auth (Bearer token)');
    process.exit(2);
  }

  // Supply a known seasonId via env for checks
  const seasonId = process.env.SEASON_ID;
  if (!seasonId) {
    console.error('Set SEASON_ID env variable to test season-scoped endpoints');
    process.exit(2);
  }

  try {
    const endpoints = [
      `/api/seasons/${seasonId}`,
      `/api/seasons/${seasonId}/teams`,
      `/api/seasons/${seasonId}/standings`,
      `/api/seasons/${seasonId}/statistics`,
    ];

    for (const ep of endpoints) {
      const res = await fetch(BASE + ep, { headers: { Authorization: `Bearer ${AUTH}` } });
      console.log(ep, res.status);
      const body = await res.text();
      console.log(body.slice(0, 100));
      if (!res.ok) {
        console.error('Non-OK response for', ep);
        process.exit(1);
      }
    }

    console.log('Smoke checks completed.');
  } catch (err) {
    console.error('Smoke checks failed', err);
    process.exit(1);
  }
}

run();
