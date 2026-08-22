-- Locks down credential_generation_logs.
--
-- This table was created without Row Level Security, which made it fully
-- readable/writable/deletable by anyone holding the public anon key
-- (Supabase grants all table privileges to anon/authenticated by default).
-- It leaks provisioning metadata (which teams have player accounts, when,
-- and by whom) and allows forged or deleted audit evidence.
--
-- All legitimate access happens through the service-role client
-- (lib/player-credentials.ts writes, app/api/admin/audit-logs reads),
-- which bypasses RLS, so no permissive policies are needed here.

ALTER TABLE public.credential_generation_logs ENABLE ROW LEVEL SECURITY;

-- Force deny for anon/authenticated even if future policies are added
-- carelessly: no SELECT/INSERT/UPDATE/DELETE policies are created on purpose.

-- Harden against accidental future exposure via direct grants as well.
REVOKE ALL ON public.credential_generation_logs FROM anon, authenticated;
