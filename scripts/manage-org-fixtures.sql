-- ============================================================
-- View & Delete Fixtures for a Specific Organization
-- Run this in the Supabase SQL Editor.
-- Replace 'YOUR_ORG_SLUG_HERE' with the org slug before running.
-- ============================================================

DO $$
DECLARE
  v_org_slug TEXT := 'YOUR_ORG_SLUG_HERE';
  v_org_id UUID;
  v_fixture_count INT;
  v_team_ids INT[];
  rec RECORD;
BEGIN
  -- 1. LOOK UP THE ORG
  SELECT id INTO v_org_id FROM organizations WHERE slug = v_org_slug;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Organization with slug "%" not found.', v_org_slug;
  END IF;

  RAISE NOTICE 'Organization: % (%)', v_org_slug, v_org_id;

  -- 2. COLLECT TEAM IDS FOR THIS ORG
  v_team_ids := ARRAY(SELECT id FROM teams WHERE organization_id = v_org_id);
  RAISE NOTICE 'Teams in org: %', array_length(v_team_ids, 1);

  IF v_team_ids IS NULL OR array_length(v_team_ids, 1) = 0 THEN
    RAISE NOTICE 'No teams found for this org. Nothing to delete.';
    RETURN;
  END IF;

  -- 3. VIEW FIXTURES
  RAISE NOTICE '====================================================';
  RAISE NOTICE 'FIXTURES FOR ORG: %', v_org_slug;
  RAISE NOTICE '====================================================';

  FOR rec IN
    SELECT
      f.id,
      f.round,
      ht.name AS home_team,
      at.name AS away_team,
      f.home_score,
      f.away_score,
      f.status,
      f.date::TEXT,
      f.competition_id
    FROM fixtures f
    JOIN teams ht ON ht.id = f.home_team_id
    JOIN teams at ON at.id = f.away_team_id
    WHERE f.home_team_id = ANY(v_team_ids)
       OR f.away_team_id = ANY(v_team_ids)
    ORDER BY f.round, f.id
  LOOP
    RAISE NOTICE '#% R% % vs % [% - %] % %',
      rec.id, rec.round,
      rec.home_team, rec.away_team,
      rec.home_score, rec.away_score,
      rec.status, rec.date;
  END LOOP;

  SELECT COUNT(*) INTO v_fixture_count
  FROM fixtures
  WHERE home_team_id = ANY(v_team_ids)
     OR away_team_id = ANY(v_team_ids);

  RAISE NOTICE '====================================================';
  RAISE NOTICE 'Total fixtures: %', v_fixture_count;

  -- ============================================================
  -- UNCOMMENT THE LINES BELOW TO DELETE ALL FIXTURES FOR THIS ORG
  -- ============================================================

  /*
  -- Delete associated match events first
  DELETE FROM match_events
  WHERE match_id IN (
    SELECT id FROM fixtures
    WHERE home_team_id = ANY(v_team_ids)
       OR away_team_id = ANY(v_team_ids)
  );

  -- Delete fixtures
  DELETE FROM fixtures
  WHERE home_team_id = ANY(v_team_ids)
     OR away_team_id = ANY(v_team_ids);

  GET DIAGNOSTICS v_fixture_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % fixtures.', v_fixture_count;
  */

END $$;
