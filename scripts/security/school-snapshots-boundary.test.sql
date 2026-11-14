-- school_intelligence_snapshots access boundary, asserted with REAL database
-- roles (anon / authenticated / service_role), not mocks.
-- Run ONLY against the disposable local stack via
--   bash scripts/security/run-shared-reports-boundary.sh scripts/security/school-snapshots-boundary.test.sql
-- All fixtures are synthetic and the whole script is rolled back.
-- Exit status is non-zero on the first failed assertion.

\set ON_ERROR_STOP on
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('f0050000-0000-4000-8000-0000000000a1', 'snap-teacher@example.invalid');

-- A verified teacher: the repository's old "school_intel_read" policy admitted
-- such a user to EVERY school's rows. The boundary must deny them too.
INSERT INTO public.teachers (user_id, full_name, school, is_verified)
VALUES ('f0050000-0000-4000-8000-0000000000a1', 'SYNTHETIC_SNAP_TEACHER', 'SYNTHETIC_SCHOOL_A', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.school_intelligence_snapshots
  (school_id, week_of, grade, subject, total_students, normal_count, watch_count, at_risk_count, critical_count,
   interventions_run, interventions_effective)
VALUES ('SYNTHETIC_SCHOOL_A', current_date, 8, 'Mathematics', 30, 20, 5, 3, 2, 1, 1);

-- ── 1. Catalog assertions ───────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.school_intelligence_snapshots'::regclass) THEN
    RAISE EXCEPTION 'FAIL: RLS disabled';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='school_intelligence_snapshots') THEN
    RAISE EXCEPTION 'FAIL: a policy exists (%)', (SELECT string_agg(policyname, ',') FROM pg_policies WHERE schemaname='public' AND tablename='school_intelligence_snapshots');
  END IF;
  IF has_table_privilege('anon','public.school_intelligence_snapshots','SELECT')
     OR has_table_privilege('authenticated','public.school_intelligence_snapshots','SELECT')
     OR has_table_privilege('public','public.school_intelligence_snapshots','SELECT') THEN
    RAISE EXCEPTION 'FAIL: browser role/PUBLIC holds SELECT';
  END IF;
  IF NOT has_table_privilege('service_role','public.school_intelligence_snapshots','SELECT') THEN
    RAISE EXCEPTION 'FAIL: service_role lost SELECT';
  END IF;
  RAISE NOTICE 'PASS catalog: RLS on, no policy, no browser-role privilege, service_role retained';
END $$;

-- ── 2. anon: denied (privilege error or zero rows) and cannot write ─────────
DO $$
DECLARE n int := 0;
BEGIN
  SET LOCAL ROLE anon;
  BEGIN
    SELECT count(*) INTO n FROM public.school_intelligence_snapshots;
    IF n <> 0 THEN RESET ROLE; RAISE EXCEPTION 'FAIL: anon read % rows', n; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.school_intelligence_snapshots (school_id, week_of, total_students, normal_count, watch_count, at_risk_count, critical_count, interventions_run, interventions_effective)
    VALUES ('ANON', current_date, 1, 1, 0, 0, 0, 0, 0);
    RESET ROLE; RAISE EXCEPTION 'FAIL: anon inserted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  RAISE NOTICE 'PASS anon: no read, no write';
END $$;

-- ── 3. authenticated (including a verified teacher): denied ─────────────────
DO $$
DECLARE n int := 0;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"f0050000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
  SET LOCAL ROLE authenticated;
  BEGIN
    SELECT count(*) INTO n FROM public.school_intelligence_snapshots;
    IF n <> 0 THEN RESET ROLE; RAISE EXCEPTION 'FAIL: verified teacher read % rows', n; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.school_intelligence_snapshots SET at_risk_count = 0;
    RESET ROLE; RAISE EXCEPTION 'FAIL: authenticated updated';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  RAISE NOTICE 'PASS authenticated: no read, no write (even a verified teacher)';
END $$;

-- ── 4. service_role: full access (the application path) ─────────────────────
DO $$
DECLARE n int;
BEGIN
  SET LOCAL ROLE service_role;
  SELECT count(*) INTO n FROM public.school_intelligence_snapshots WHERE school_id = 'SYNTHETIC_SCHOOL_A';
  IF n <> 1 THEN RESET ROLE; RAISE EXCEPTION 'FAIL: service_role cannot read its own row (%)', n; END IF;
  UPDATE public.school_intelligence_snapshots SET risk_trend = 'stable' WHERE school_id = 'SYNTHETIC_SCHOOL_A';
  INSERT INTO public.school_intelligence_snapshots (school_id, week_of, total_students, normal_count, watch_count, at_risk_count, critical_count, interventions_run, interventions_effective)
  VALUES ('SYNTHETIC_SCHOOL_B', current_date, 10, 10, 0, 0, 0, 0, 0);
  RESET ROLE;
  RAISE NOTICE 'PASS service_role: read, update, insert';
END $$;

ROLLBACK;
\echo 'school_intelligence_snapshots boundary: ALL PASS (rolled back)'
