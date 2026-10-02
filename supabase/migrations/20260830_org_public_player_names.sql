ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS public_player_names_enabled BOOLEAN NOT NULL DEFAULT FALSE;
