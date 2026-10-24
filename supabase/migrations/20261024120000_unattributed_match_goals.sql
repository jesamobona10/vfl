-- A match goal is valid even before a team roster has been registered.
ALTER TABLE public.match_events
  ALTER COLUMN player_id DROP NOT NULL;

-- Keep the event row and fixture score in one transaction. Locking the fixture
-- row prevents simultaneous goals from overwriting each other's score updates.
CREATE OR REPLACE FUNCTION public.record_match_goal(
  p_match_id bigint,
  p_team_id bigint,
  p_player_id bigint,
  p_minute integer,
  p_organization_id uuid
)
RETURNS TABLE (event_id bigint, home_score integer, away_score integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_home_team_id bigint;
  v_away_team_id bigint;
  v_competition_id uuid;
  v_season_id uuid;
  v_event_id bigint;
BEGIN
  SELECT f.home_team_id, f.away_team_id, f.competition_id, f.season_id
    INTO v_home_team_id, v_away_team_id, v_competition_id, v_season_id
    FROM public.fixtures f
   WHERE f.id = p_match_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fixture not found';
  END IF;
  IF p_team_id NOT IN (v_home_team_id, v_away_team_id) THEN
    RAISE EXCEPTION 'Scoring team is not part of this fixture';
  END IF;
  IF p_player_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.players p WHERE p.id = p_player_id AND p.team_id = p_team_id
  ) THEN
    RAISE EXCEPTION 'Player does not belong to the scoring team';
  END IF;

  INSERT INTO public.match_events (
    match_id, player_id, team_id, event_type, minute,
    competition_id, season_id, organization_id
  ) VALUES (
    p_match_id, p_player_id, p_team_id, 'goal', p_minute,
    v_competition_id, v_season_id, p_organization_id
  ) RETURNING id INTO v_event_id;

  RETURN QUERY
  UPDATE public.fixtures f
     SET home_score = COALESCE(f.home_score, 0) + CASE WHEN p_team_id = v_home_team_id THEN 1 ELSE 0 END,
         away_score = COALESCE(f.away_score, 0) + CASE WHEN p_team_id = v_away_team_id THEN 1 ELSE 0 END
   WHERE f.id = p_match_id
   RETURNING v_event_id, f.home_score, f.away_score;
END;
$$;

REVOKE ALL ON FUNCTION public.record_match_goal(bigint, bigint, bigint, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_match_goal(bigint, bigint, bigint, integer, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.delete_match_goal(p_event_id bigint)
RETURNS TABLE (match_id bigint, team_id bigint, home_score integer, away_score integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_match_id bigint;
  v_team_id bigint;
  v_home_team_id bigint;
  v_away_team_id bigint;
BEGIN
  SELECT me.match_id, me.team_id
    INTO v_match_id, v_team_id
    FROM public.match_events me
   WHERE me.id = p_event_id AND me.event_type = 'goal'
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Goal event not found';
  END IF;

  SELECT f.home_team_id, f.away_team_id
    INTO v_home_team_id, v_away_team_id
    FROM public.fixtures f
   WHERE f.id = v_match_id
   FOR UPDATE;

  DELETE FROM public.match_events WHERE id = p_event_id;

  RETURN QUERY
  UPDATE public.fixtures f
     SET home_score = GREATEST(0, COALESCE(f.home_score, 0) - CASE WHEN v_team_id = v_home_team_id THEN 1 ELSE 0 END),
         away_score = GREATEST(0, COALESCE(f.away_score, 0) - CASE WHEN v_team_id = v_away_team_id THEN 1 ELSE 0 END)
   WHERE f.id = v_match_id
   RETURNING v_match_id, v_team_id, f.home_score, f.away_score;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_match_goal(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_match_goal(bigint) TO service_role;
