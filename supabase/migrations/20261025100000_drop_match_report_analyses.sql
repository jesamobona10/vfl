-- The AI match-report feature has been removed, so its storage table is no
-- longer used. Dropping it also removes the associated indexes and policies.
DROP TABLE IF EXISTS public.match_report_analyses CASCADE;
