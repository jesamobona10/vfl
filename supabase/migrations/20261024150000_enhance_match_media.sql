ALTER TABLE public.match_media
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS thumbnail_path text,
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS duration_seconds numeric(10,2),
  ADD COLUMN IF NOT EXISTS width integer,
  ADD COLUMN IF NOT EXISTS height integer,
  ADD COLUMN IF NOT EXISTS alt_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.match_media ADD CONSTRAINT match_media_status_check
    CHECK (status IN ('pending', 'published', 'rejected', 'hidden'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.match_media ADD CONSTRAINT match_media_category_check
    CHECK (category IN ('goal', 'save', 'celebration', 'team_photo', 'crowd', 'match_action', 'other'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.match_media ADD CONSTRAINT match_media_file_size_check
    CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.match_media ADD CONSTRAINT match_media_dimensions_check
    CHECK ((width IS NULL OR width > 0) AND (height IS NULL OR height > 0));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS match_media_public_gallery_idx
  ON public.match_media (match_id, status, sort_order, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS match_media_org_status_idx
  ON public.match_media (organization_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS match_media_storage_path_unique_idx
  ON public.match_media (storage_path) WHERE storage_path IS NOT NULL;
