-- Add an optional client-generated id to match_events so a retried or
-- double-tapped write is idempotent. The partial unique index only applies
-- to non-null values, so every legacy row (and any event logged without a
-- client_event_id) is unaffected.
--
-- This is the ONLY schema change permitted by the Match Logger guardrails.

alter table public.match_events
  add column if not exists client_event_id uuid;

-- Idempotency is scoped per fixture: two different fixtures may legitimately
-- receive the same client id (extremely unlikely with UUIDs, but the index
-- should encode the real invariant).
create unique index if not exists match_events_client_event_id_key
  on public.match_events (match_id, client_event_id)
  where client_event_id is not null;
