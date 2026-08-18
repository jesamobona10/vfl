-- ============================================================
-- Migration: Prevent race condition on admin-user bootstrap
--
-- Adds a partial unique index that limits admin_users to a
-- single row at the database level, making it physically
-- impossible for concurrent requests to create a second admin.
--
-- The route handler has been updated to rely on this constraint
-- (INSERT directly, catch unique violation) instead of the
-- racy count-then-insert pattern.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS admin_users_singleton
  ON admin_users ((true));
