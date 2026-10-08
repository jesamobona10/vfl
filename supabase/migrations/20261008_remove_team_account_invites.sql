-- Remove the retired team invite/claim feature.

DROP FUNCTION IF EXISTS public.claim_team_account_invite();
DROP TABLE IF EXISTS public.team_account_invites;
