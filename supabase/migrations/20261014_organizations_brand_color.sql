-- ============================================================
-- Organization brand color
--
-- Optional per-organization accent color, stored as a normalized
-- `#rrggbb` string. Unset or invalid values fall back to the default
-- brand palette at render time (see lib/branding.ts).
--
-- The value is validated server-side on write: it must be a hex color
-- and must be able to produce readable text on the brand surfaces.
-- ============================================================

BEGIN;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS brand_color TEXT;

COMMENT ON COLUMN organizations.brand_color IS
  'Optional per-org accent color (#rrggbb). Null/invalid falls back to the default brand.';

COMMIT;
