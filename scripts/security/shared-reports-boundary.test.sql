-- DSA-01 regression: shared_reports access boundary, asserted with REAL
-- database roles (anon / authenticated / service_role), not mocks.
-- Run ONLY against the disposable local stack via
--   bash scripts/security/run-shared-reports-boundary.sh
-- All fixtures are synthetic and the whole script is rolled back.
-- Exit status is non-zero on the first failed assertion.

\set ON_ERROR_STOP on
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('f0040000-0000-4000-8000-0000000000a1', 'dsa01-owner@example.invalid'),
  ('f0040000-0000-4000-8000-0000000000b2', 'dsa01-other@example.invalid');

INSERT INTO public.students (id, user_id, parent_user_id, name, grade, level, school, added_by)
VALUES ('f0040000-0000-4000-8000-0000000000c3',
        'f0040000-0000-4000-8000-0000000000a1', 'f0040000-0000-4000-8000-0000000000a1',
        'SYNTHETIC_DSA01', 8, 'Junior School', 'SYNTHETIC_DSA01', 'parent');

-- token, expires_at, revoked_at, report_data
INSERT INTO public.shared_reports (token, student_id, user_id, student_name, grade, expires_at, revoked_at, report_data)
SELECT t.token, 'f0040000-0000-4000-8000-0000000000c3', 'f0040000-0000-4000-8000-0000000000a1',
       'SYNTHETIC_DSA01', '8', t.expires_at, t.revoked_at, t.report_data
FROM (VALUES
  ('VALIDtokenVALIDtokenVALIDtoken_1', now() + interval '10 days', NULL::timestamptz,
     '{"strengths":["a"],"priorityAreas":["b"],"actionPlan":["c"],"subjectScores":{"english":3},"overallLevel":3,"overallLabel":"Proficient","parent_phone":"0700000000","internal_note":"must-not-leak"}'::jsonb),
  ('DELETEMEtokenDELETEMEtokenDELE_1', now() + interval '10 days', NULL,
     '{"strengths":["deletable"]}'::jsonb),
  ('EXPIREDtokenEXPIREDtokenEXPIRE_1', now() - interval '1 day',   NULL,
     '{"strengths":["expired-secret"]}'::jsonb),
  ('REVOKEDtokenREVOKEDtokenREVOKE_1', now() + interval '10 days', now(),
     '{"strengths":["revoked-secret"]}'::jsonb)
) AS t(token, expires_at, revoked_at, report_data);

-- ── 1. Catalog assertions ───────────────────────────────────────────────────
DO $$
DECLARE fn oid := 'public.get_shared_report_by_token(text)'::regprocedure;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shared_reports'
             AND cmd IN ('SELECT','ALL') AND (qual IS NULL OR btrim(qual)='true')) THEN
    RAISE EXCEPTION 'FAIL: unrestricted read policy present';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.shared_reports'::regclass) THEN
    RAISE EXCEPTION 'FAIL: RLS disabled';
  END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid=fn) THEN RAISE EXCEPTION 'FAIL: function not SECURITY DEFINER'; END IF;
  -- The migration (and production) pin search_path to ''. A bootstrapped DB
  -- replays prod's one-shot July hardening sweeps AFTER the migrations, which
  -- normalise every function to 'public'; both are pinned and the body is
  -- fully schema-qualified. NULL (unpinned) is the failure.
  IF NOT ((SELECT proconfig FROM pg_proc WHERE oid=fn) && ARRAY['search_path=""', 'search_path=public']) THEN
    RAISE EXCEPTION 'FAIL: function search_path not pinned (%)', (SELECT proconfig FROM pg_proc WHERE oid=fn);
  END IF;
  IF has_function_privilege('anon', fn, 'EXECUTE') OR has_function_privilege('authenticated', fn, 'EXECUTE')
     OR has_function_privilege('public', fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: browser role/PUBLIC can execute token lookup';
  END IF;
  IF NOT has_function_privilege('service_role', fn, 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: service_role cannot execute token lookup';
  END IF;
  IF (SELECT proargnames FROM pg_proc WHERE oid=fn) IS DISTINCT FROM
     ARRAY['p_token','status','student_name','grade','report_data','created_at','expires_at','provenance'] THEN
    RAISE EXCEPTION 'FAIL: DTO columns changed (must not expose id/token/student_id/user_id): %',
      (SELECT proargnames FROM pg_proc WHERE oid=fn);
  END IF;
  RAISE NOTICE 'PASS catalog: no open policy, RLS on, DEFINER + pinned search_path, service-role-only EXECUTE, fixed DTO columns';
END $$;

-- ── 2. anon: nothing, directly or via the lookup ────────────────────────────
DO $$
DECLARE n int;
BEGIN
  SET LOCAL ROLE anon;
  BEGIN
    SELECT count(*) INTO n FROM public.shared_reports;
    IF n <> 0 THEN RESET ROLE; RAISE EXCEPTION 'FAIL: anon read % rows', n; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.shared_reports (token, student_id, user_id, student_name, grade, expires_at)
    VALUES ('ANONINSERT123456', 'f0040000-0000-4000-8000-0000000000c3', 'f0040000-0000-4000-8000-0000000000a1', 'x', '8', now());
    RESET ROLE; RAISE EXCEPTION 'FAIL: anon INSERT succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.shared_reports SET student_name = 'pwn';
    RESET ROLE; RAISE EXCEPTION 'FAIL: anon UPDATE succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    DELETE FROM public.shared_reports;
    RESET ROLE; RAISE EXCEPTION 'FAIL: anon DELETE succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM * FROM public.get_shared_report_by_token('VALIDtokenVALIDtokenVALIDtoken_1');
    RESET ROLE; RAISE EXCEPTION 'FAIL: anon executed token lookup';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  RAISE NOTICE 'PASS anon: no direct select/insert/update/delete, no lookup RPC, even with a valid token';
END $$;

-- ── 3. authenticated: non-owner and owner ───────────────────────────────────
DO $$
DECLARE n int;
BEGIN
  -- non-owner
  PERFORM set_config('request.jwt.claims', '{"sub":"f0040000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
  PERFORM set_config('request.jwt.claim.sub', 'f0040000-0000-4000-8000-0000000000b2', true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.shared_reports;
  IF n <> 0 THEN RESET ROLE; RAISE EXCEPTION 'FAIL: non-owner read % rows', n; END IF;
  DELETE FROM public.shared_reports;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RESET ROLE; RAISE EXCEPTION 'FAIL: non-owner deleted % rows', n; END IF;
  BEGIN
    PERFORM * FROM public.get_shared_report_by_token('VALIDtokenVALIDtokenVALIDtoken_1');
    RESET ROLE; RAISE EXCEPTION 'FAIL: authenticated executed token lookup';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;

  -- owner
  PERFORM set_config('request.jwt.claims', '{"sub":"f0040000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
  PERFORM set_config('request.jwt.claim.sub', 'f0040000-0000-4000-8000-0000000000a1', true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.shared_reports;
  IF n <> 4 THEN RESET ROLE; RAISE EXCEPTION 'FAIL: owner sees % of their own 4 rows', n; END IF;
  BEGIN
    INSERT INTO public.shared_reports (token, student_id, user_id, student_name, grade, expires_at)
    VALUES ('OWNERINSERT12345', 'f0040000-0000-4000-8000-0000000000c3', 'f0040000-0000-4000-8000-0000000000a1', 'x', '8', now());
    RESET ROLE; RAISE EXCEPTION 'FAIL: authenticated direct INSERT succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.shared_reports SET revoked_at = NULL;
    RESET ROLE; RAISE EXCEPTION 'FAIL: authenticated direct UPDATE succeeded (could un-revoke)';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  DELETE FROM public.shared_reports WHERE token = 'DELETEMEtokenDELETEMEtokenDELE_1';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RESET ROLE; RAISE EXCEPTION 'FAIL: owner could not delete own row'; END IF;
  RESET ROLE;
  RAISE NOTICE 'PASS authenticated: non-owner sees/deletes nothing and cannot call lookup; owner reads only own rows, may delete, cannot insert/update directly';
END $$;

-- ── 4. service_role lookup behaviour ────────────────────────────────────────
DO $$
DECLARE r record; n int; i int;
BEGIN
  SET LOCAL ROLE service_role;

  SELECT * INTO r FROM public.get_shared_report_by_token('VALIDtokenVALIDtokenVALIDtoken_1');
  IF r.status IS DISTINCT FROM 'ok' OR r.student_name IS DISTINCT FROM 'SYNTHETIC_DSA01' THEN
    RESET ROLE; RAISE EXCEPTION 'FAIL: valid token did not resolve: %', r;
  END IF;
  IF r.provenance IS DISTINCT FROM 'client_supplied' THEN
    RESET ROLE; RAISE EXCEPTION 'FAIL: default provenance is not client_supplied: %', r.provenance;
  END IF;
  IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(r.report_data) k)
     IS DISTINCT FROM ARRAY['actionPlan','overallLabel','overallLevel','priorityAreas','strengths','subjectScores'] THEN
    RESET ROLE; RAISE EXCEPTION 'FAIL: report_data DTO has unexpected keys: %', r.report_data;
  END IF;
  IF r.report_data::text LIKE '%must-not-leak%' OR r.report_data::text LIKE '%0700000000%' THEN
    RESET ROLE; RAISE EXCEPTION 'FAIL: unlisted report_data fields leaked';
  END IF;

  SELECT * INTO r FROM public.get_shared_report_by_token('EXPIREDtokenEXPIREDtokenEXPIRE_1');
  IF r.status IS DISTINCT FROM 'expired' OR r.student_name IS NOT NULL OR r.grade IS NOT NULL
     OR r.report_data IS NOT NULL OR r.created_at IS NOT NULL OR r.expires_at IS NOT NULL OR r.provenance IS NOT NULL THEN
    RESET ROLE; RAISE EXCEPTION 'FAIL: expired token returned data: %', r;
  END IF;

  -- revoked, unknown, malformed and wildcard-looking tokens: all zero rows
  FOREACH r.status IN ARRAY ARRAY[
    'REVOKEDtokenREVOKEDtokenREVOKE_1', 'NOSUCHtokenNOSUCHtokenNOSUCH_123', '', 'short', 'ABCDEF12345',
    '____________', '%%%%%%%%%%%%', 'VALIDtokenVALIDtokenVALIDtoken_%', 'x'' OR ''1''=''1xxxxxxx',
    repeat('A', 31), repeat('A', 33), repeat('A', 65), 'ABCDEF123456',  -- 12-char legacy format
    'DELETEMEtokenDELETEMEtokenDELE_1'  -- deleted by its owner in step 3, must now be gone
  ] LOOP
    SELECT count(*) INTO n FROM public.get_shared_report_by_token(r.status);
    IF n <> 0 THEN RESET ROLE; RAISE EXCEPTION 'FAIL: token [%] returned % rows', r.status, n; END IF;
  END LOOP;
  SELECT count(*) INTO n FROM public.get_shared_report_by_token(NULL);
  IF n <> 0 THEN RESET ROLE; RAISE EXCEPTION 'FAIL: NULL token returned rows'; END IF;

  -- enumeration resistance: random 32-char guesses never hit
  FOR i IN 1..300 LOOP
    SELECT count(*) INTO n FROM public.get_shared_report_by_token(translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_A'));
    IF n <> 0 THEN RESET ROLE; RAISE EXCEPTION 'FAIL: random guess hit a row'; END IF;
  END LOOP;
  RESET ROLE;
  RAISE NOTICE 'PASS service_role: valid ok w/ whitelisted DTO; expired returns no data; revoked/unknown/malformed/wildcard/NULL return nothing; 300 random guesses miss';
END $$;

-- ── 4b. provenance is exposed so the reader can state a report's true origin ─
INSERT INTO public.shared_reports (token, student_id, user_id, student_name, grade, expires_at, provenance)
VALUES ('SERVERGENtokenSERVERGENtokenSE_1', 'f0040000-0000-4000-8000-0000000000c3', 'f0040000-0000-4000-8000-0000000000a1',
        'SYNTHETIC_DSA01', '8', now() + interval '5 days', 'server_generated');
DO $$
DECLARE r record;
BEGIN
  SET LOCAL ROLE service_role;
  SELECT * INTO r FROM public.get_shared_report_by_token('SERVERGENtokenSERVERGENtokenSE_1');
  RESET ROLE;
  IF r.provenance IS DISTINCT FROM 'server_generated' THEN RAISE EXCEPTION 'FAIL: server_generated provenance not returned: %', r.provenance; END IF;
  RAISE NOTICE 'PASS provenance: client_supplied by default, server_generated when set';
END $$;

-- ── 5. legacy 12-char tokens are RETIRED ───────────────────────────────────
-- (a) the table CHECK refuses to mint one, even for the owner of the table;
-- (b) even if a legacy row existed, the lookup refuses to resolve it.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.shared_reports (token, student_id, user_id, student_name, grade, expires_at)
    VALUES ('LEGACY123456', 'f0040000-0000-4000-8000-0000000000c3', 'f0040000-0000-4000-8000-0000000000a1', 'x', '8', now() + interval '5 days');
    RAISE EXCEPTION 'FAIL: a legacy 12-char token could be inserted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

ALTER TABLE public.shared_reports DROP CONSTRAINT shared_reports_token_format;  -- rolled back with the txn
INSERT INTO public.shared_reports (token, student_id, user_id, student_name, grade, expires_at, report_data)
VALUES ('LEGACY123456', 'f0040000-0000-4000-8000-0000000000c3', 'f0040000-0000-4000-8000-0000000000a1',
        'SYNTHETIC_DSA01', '8', now() + interval '5 days', '{"strengths":["legacy"]}');
DO $$
DECLARE n int;
BEGIN
  SET LOCAL ROLE service_role;
  SELECT count(*) INTO n FROM public.get_shared_report_by_token('LEGACY123456');
  RESET ROLE;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: legacy 12-char token still resolves'; END IF;
  RAISE NOTICE 'PASS legacy retired: 12-char token cannot be inserted and never resolves';
END $$;
ALTER TABLE public.shared_reports ADD CONSTRAINT shared_reports_token_format
  CHECK (token ~ '^[A-Za-z0-9_-]{32}$') NOT VALID;
DELETE FROM public.shared_reports WHERE token = 'LEGACY123456';

-- ── 6. report-creation caps hold even for the service role ──────────────────
DO $$
BEGIN
  SET LOCAL ROLE service_role;
  BEGIN
    INSERT INTO public.shared_reports (token, student_id, user_id, student_name, grade, expires_at)
    VALUES ('LONGEXPIRY_xxxxxxxxxxxxxxxxxxxxx', 'f0040000-0000-4000-8000-0000000000c3', 'f0040000-0000-4000-8000-0000000000a1', 'x', '8', now() + interval '91 days');
    RESET ROLE; RAISE EXCEPTION 'FAIL: 91-day expiry accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.shared_reports (token, student_id, user_id, student_name, grade, expires_at, report_data)
    VALUES ('BIGREPORT_xxxxxxxxxxxxxxxxxxxxxx', 'f0040000-0000-4000-8000-0000000000c3', 'f0040000-0000-4000-8000-0000000000a1', 'x', '8',
            now() + interval '5 days', jsonb_build_object('strengths', jsonb_build_array(repeat('x', 20000))));
    RESET ROLE; RAISE EXCEPTION 'FAIL: 20 KB report accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.shared_reports (token, student_id, user_id, student_name, grade, expires_at, provenance)
    VALUES ('BADPROV_xxxxxxxxxxxxxxxxxxxxxxxx', 'f0040000-0000-4000-8000-0000000000c3', 'f0040000-0000-4000-8000-0000000000a1', 'x', '8',
            now() + interval '5 days', 'official');
    RESET ROLE; RAISE EXCEPTION 'FAIL: unknown provenance accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  INSERT INTO public.shared_reports (token, student_id, user_id, student_name, grade, expires_at)
  VALUES ('GOODEXPIRY_xxxxxxxxxxxxxxxxxxxxx', 'f0040000-0000-4000-8000-0000000000c3', 'f0040000-0000-4000-8000-0000000000a1', 'x', '8', now() + interval '89 days');
  RESET ROLE;
  RAISE NOTICE 'PASS caps: >90-day expiry, >16 KiB report, unknown provenance all rejected; 89 days accepted';
END $$;

ROLLBACK;
\echo 'ALL SHARED_REPORTS BOUNDARY ASSERTIONS PASSED'
