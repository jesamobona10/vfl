-- The original goal RPCs were shipped with a non-empty search_path. Keep the
-- applied migration immutable and harden the effective function settings here.
ALTER FUNCTION public.record_match_goal(bigint, bigint, bigint, integer, uuid)
  SET search_path = '';

ALTER FUNCTION public.delete_match_goal(bigint)
  SET search_path = '';
