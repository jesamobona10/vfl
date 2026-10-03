-- Persist authenticated public match preferences independently of the browser
-- and allow each active push endpoint to choose its pre-match reminder times.
CREATE TABLE IF NOT EXISTS user_public_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_ids BIGINT[] NOT NULL DEFAULT '{}',
  reminder_minutes SMALLINT[] NOT NULL DEFAULT ARRAY[60, 30, 15]::SMALLINT[],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_public_preferences_reminders_valid
    CHECK (reminder_minutes <@ ARRAY[60, 30, 15]::SMALLINT[])
);

ALTER TABLE user_public_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON user_public_preferences FROM anon, authenticated;
GRANT ALL ON user_public_preferences TO service_role;

ALTER TABLE public_push_subscriptions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reminder_minutes SMALLINT[] NOT NULL DEFAULT ARRAY[60, 30, 15]::SMALLINT[];

CREATE INDEX IF NOT EXISTS idx_public_push_subscriptions_user
  ON public_push_subscriptions(user_id);

-- One claim per fixture and lead time prevents overlapping cron invocations
-- from sending duplicate reminders.
CREATE TABLE IF NOT EXISTS public_match_reminder_deliveries (
  fixture_id BIGINT NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
  lead_minutes SMALLINT NOT NULL CHECK (lead_minutes IN (15, 30, 60)),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (fixture_id, lead_minutes)
);

ALTER TABLE public_match_reminder_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public_match_reminder_deliveries FROM anon, authenticated;
GRANT ALL ON public_match_reminder_deliveries TO service_role;

CREATE INDEX IF NOT EXISTS idx_fixtures_scheduled_date
  ON fixtures(date) WHERE status = 'scheduled';
