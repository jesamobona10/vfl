-- Ensure the team-logos storage bucket exists and is public, with policies
-- mirroring the bucket setup that historically lived only in the legacy
-- migration.sql monolith. Uploads go through the service role (bypassing RLS),
-- so the authenticated rules primarily cover direct/back-office actions and
-- the public SELECT rule is what makes stored logo URLs render in browsers.

INSERT INTO storage.buckets (id, name, public)
VALUES ('team-logos', 'team-logos', true)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      name = EXCLUDED.name;

-- Allow anyone (including unauthenticated visitors and next/image) to read
-- public team logos.
DROP POLICY IF EXISTS "team_logos_public_select" ON storage.objects;
CREATE POLICY "team_logos_public_select"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'team-logos');

-- Allow authenticated users to manage team logo objects in this bucket.
DROP POLICY IF EXISTS "team_logos_authenticated_insert" ON storage.objects;
CREATE POLICY "team_logos_authenticated_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'team-logos');

DROP POLICY IF EXISTS "team_logos_authenticated_update" ON storage.objects;
CREATE POLICY "team_logos_authenticated_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'team-logos');

DROP POLICY IF EXISTS "team_logos_authenticated_delete" ON storage.objects;
CREATE POLICY "team_logos_authenticated_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'team-logos');
