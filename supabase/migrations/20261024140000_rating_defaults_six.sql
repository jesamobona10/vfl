ALTER TABLE public.players ALTER COLUMN rating SET DEFAULT 6.0;

-- Older installs used zero as the database default, although the application
-- rating scale starts at 1. Normalize those untouched baseline values.
UPDATE public.players
SET rating = 6.0
WHERE rating IS NULL OR rating <= 0;

ALTER TABLE public.teams ALTER COLUMN rating SET DEFAULT 6.0;

