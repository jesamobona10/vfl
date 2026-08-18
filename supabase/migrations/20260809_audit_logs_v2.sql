-- ============================================================
-- Migration: Structured audit log fields for auth_audit_logs.
-- Adds tenant-scoped, human-readable audit events with
-- before/after values, actor role, resource info, category and
-- severity. Backward compatible: all new columns are nullable.
-- ============================================================

ALTER TABLE auth_audit_logs
  ADD COLUMN IF NOT EXISTS action TEXT,
  ADD COLUMN IF NOT EXISTS actor_role TEXT,
  ADD COLUMN IF NOT EXISTS resource_type TEXT,
  ADD COLUMN IF NOT EXISTS resource_id TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS before JSONB,
  ADD COLUMN IF NOT EXISTS after JSONB,
  ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS severity TEXT;

-- Keep event_type in sync for legacy readers (event_type = action)
UPDATE auth_audit_logs
   SET action = event_type
 WHERE action IS NULL;

CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_org_created
  ON auth_audit_logs(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_action
  ON auth_audit_logs(action);

CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_resource_type
  ON auth_audit_logs(resource_type);
