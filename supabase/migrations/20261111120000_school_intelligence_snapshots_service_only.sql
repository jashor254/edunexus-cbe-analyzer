-- 20261111120000_school_intelligence_snapshots_service_only.sql
--
-- Closes the public read on public.school_intelligence_snapshots.
--
-- Observed production state (read-only catalog check, 2026-11-11): RLS enabled;
-- ONE policy "teachers_read_school_snapshots" FOR SELECT TO public USING (true);
-- anon and authenticated hold table-level privileges (Supabase defaults).
-- Any anonymous Data API caller could therefore list every school's weekly
-- aggregates (at-risk/critical counts, top struggling sub-strands, capability
-- averages) keyed by school_id. The table had 0 rows when verified.
--
-- POLICY DRIFT: no file in this repository creates "teachers_read_school_snapshots".
-- The repository's own definition (20260628_eios_foundation.sql) is
-- "school_intel_read" (service role OR any verified teacher), and a bootstrap of
-- the repository reproduces THAT policy, not production's. Production's policy
-- was therefore applied out of band. This migration removes BOTH names so the
-- repository and production converge on the same state regardless of which one
-- is present. (school_intel_read was itself too broad: it admitted every
-- verified teacher to every school's rows because it is not school-scoped.)
--
-- Boundary after this migration:
--   * No policy for anon/authenticated (RLS stays ENABLED => deny-all to them).
--   * anon/authenticated/PUBLIC hold no table privileges.
--   * service_role keeps full access (it bypasses RLS; the grant is re-asserted).
-- Application impact: none. Every reader/writer goes through SchoolRepository
-- (lib/repositories/school.repository.ts), whose BaseRepository builds a
-- service-role client; /api/school/intelligence authenticates the caller and
-- then reads through that repository. No client component or user-scoped client
-- touches this table.
--
-- Idempotent. One transaction. Ends with a self-check that aborts the whole
-- migration if any policy remains, if a browser role keeps a privilege, or if
-- service_role lost access.
--
-- Rollback (INSECURE — re-opens public read of school aggregates; use only to
-- restore the previous production state in an emergency, prefer fix-forward):
--   CREATE POLICY "teachers_read_school_snapshots"
--     ON public.school_intelligence_snapshots FOR SELECT USING (true);
--   GRANT SELECT ON public.school_intelligence_snapshots TO anon, authenticated;

BEGIN;

ALTER TABLE public.school_intelligence_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teachers_read_school_snapshots" ON public.school_intelligence_snapshots;
DROP POLICY IF EXISTS "school_intel_read"              ON public.school_intelligence_snapshots;

REVOKE ALL ON public.school_intelligence_snapshots FROM PUBLIC;
REVOKE ALL ON public.school_intelligence_snapshots FROM anon;
REVOKE ALL ON public.school_intelligence_snapshots FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_intelligence_snapshots TO service_role;

DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.school_intelligence_snapshots'::regclass) THEN
    RAISE EXCEPTION 'school_intelligence_snapshots: RLS is not enabled';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'school_intelligence_snapshots') THEN
    RAISE EXCEPTION 'school_intelligence_snapshots: a policy still exists';
  END IF;

  IF has_table_privilege('anon', 'public.school_intelligence_snapshots', 'SELECT')
     OR has_table_privilege('anon', 'public.school_intelligence_snapshots', 'INSERT')
     OR has_table_privilege('anon', 'public.school_intelligence_snapshots', 'UPDATE')
     OR has_table_privilege('anon', 'public.school_intelligence_snapshots', 'DELETE')
     OR has_table_privilege('authenticated', 'public.school_intelligence_snapshots', 'SELECT')
     OR has_table_privilege('authenticated', 'public.school_intelligence_snapshots', 'INSERT')
     OR has_table_privilege('authenticated', 'public.school_intelligence_snapshots', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.school_intelligence_snapshots', 'DELETE') THEN
    RAISE EXCEPTION 'school_intelligence_snapshots: a browser role still holds a privilege';
  END IF;

  IF NOT (has_table_privilege('service_role', 'public.school_intelligence_snapshots', 'SELECT')
          AND has_table_privilege('service_role', 'public.school_intelligence_snapshots', 'INSERT')
          AND has_table_privilege('service_role', 'public.school_intelligence_snapshots', 'UPDATE')) THEN
    RAISE EXCEPTION 'school_intelligence_snapshots: service_role lost access';
  END IF;
END
$$;

COMMIT;
