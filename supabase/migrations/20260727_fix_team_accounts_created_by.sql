-- ============================================================
-- Fix team_accounts.created_by FK: was referencing
-- admin_users(id), which excludes org-admins who are not
-- super-admins.  Change to auth.users(id) so any
-- authenticated user can be recorded as the creator.
-- ============================================================

ALTER TABLE team_accounts
  DROP CONSTRAINT IF EXISTS team_accounts_created_by_fkey;

ALTER TABLE team_accounts
  ADD CONSTRAINT team_accounts_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id)
    ON DELETE SET NULL;
