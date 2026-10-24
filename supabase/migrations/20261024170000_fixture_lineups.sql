CREATE TABLE IF NOT EXISTS public.fixture_lineups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id bigint NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
  team_id bigint NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  formation text NOT NULL,
  starting_xi jsonb NOT NULL,
  substitutes jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fixture_lineups_unique_team_match UNIQUE (fixture_id, team_id),
  CONSTRAINT fixture_lineups_starting_xi_array CHECK (jsonb_typeof(starting_xi) = 'array'),
  CONSTRAINT fixture_lineups_substitutes_array CHECK (jsonb_typeof(substitutes) = 'array')
);

CREATE INDEX IF NOT EXISTS fixture_lineups_public_review_idx
  ON public.fixture_lineups (fixture_id, status, team_id);
CREATE INDEX IF NOT EXISTS fixture_lineups_org_review_idx
  ON public.fixture_lineups (organization_id, status, submitted_at DESC);

ALTER TABLE public.fixture_lineups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fixture_lineups FROM anon, authenticated;
GRANT ALL ON public.fixture_lineups TO service_role;
