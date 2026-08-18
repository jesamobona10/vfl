-- ============================================================
-- Migration: AI match report analyses.
-- Stores one row per NLP/LLM analysis of a written match report.
-- The analysis is a PROPOSAL only — confirmed events are written
-- to match_events separately (never directly by the AI).
-- ============================================================

CREATE TABLE IF NOT EXISTS match_report_analyses (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  match_id BIGINT NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
  created_by UUID,
  raw_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PROCESSING',
  events JSONB NOT NULL DEFAULT '[]',
  warnings JSONB NOT NULL DEFAULT '[]',
  score JSONB,
  model TEXT,
  prompt_version TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_match_report_analyses_org_created
  ON match_report_analyses(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_match_report_analyses_match
  ON match_report_analyses(match_id);

CREATE INDEX IF NOT EXISTS idx_match_report_analyses_status
  ON match_report_analyses(status);

-- RLS: matches are org-scoped via their two teams; route handlers
-- additionally enforce tenant membership with service-role reads.
ALTER TABLE match_report_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY match_report_analyses_org_select
  ON match_report_analyses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM fixtures f
      JOIN teams t ON t.id IN (f.home_team_id, f.away_team_id)
      WHERE f.id = match_report_analyses.match_id
        AND t.organization_id = match_report_analyses.organization_id
    )
  );