# Production Readiness Checklist

This file tracks concrete production-hardening milestones.

## Engineering Quality

- [x] Baseline CI workflow for lint, build, tests, and migration file checks
- [x] Unit test foundation for core league logic
- [ ] Expand API integration tests for auth and data endpoints
- [ ] Add end-to-end role-based flow tests (admin/team/player)

## Platform & Security

- [x] Environment variable template (`.env.example`)
- [x] Runtime environment validation for required Supabase configuration
- [ ] Add dependency vulnerability scanning in CI
- [ ] Add secret scanning and branch protection requirements

## Data & Migrations

- [x] Migration presence/order checks in CI
- [ ] Add migration promotion workflow (dev -> staging -> production)
- [ ] Define migration rollback policy (forward-fix only)

## Observability & Operations

- [x] Operational runbook for deploy/rollback/incidents/restore
- [ ] Centralize logs and define alert rules (401/403/429/5xx spikes)
- [ ] Track service-level objectives and error budgets

## Performance & Resilience

- [ ] Add pagination/filtering on high-volume endpoints
- [ ] Introduce distributed rate limiting/WAF protections
- [ ] Add load tests for live score and match-day traffic
