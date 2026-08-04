-- Security remediation sprint — Phase 1.
--
-- provision_teacher_school(uuid, text) is SECURITY DEFINER (bypasses RLS)
-- and its only GRANT statement (in the original migration,
-- 20260802090200_phase0_provision_teacher_school_function.sql) was
-- `GRANT EXECUTE ... TO service_role`. That grant is additive, not
-- exclusive — Postgres grants EXECUTE on new functions to PUBLIC by
-- default, and that default was never revoked. Confirmed live via
-- has_function_privilege(): anon and authenticated could both call
-- POST /rest/v1/rpc/provision_teacher_school directly, passing any
-- p_user_id — the function trusted the argument with no check against
-- auth.uid(), and being SECURITY DEFINER, its INSERTs into schools/
-- school_users bypassed RLS entirely. Net effect: any anon or
-- authenticated caller could provision (or reuse) a school and grant
-- school_admin membership for an arbitrary user id.
--
-- lib/core/institutionOwnership.ts:87 is the only call site in the
-- codebase, and it always goes through createServiceClient() — so
-- locking this down to service_role only breaks nothing.
--
-- Fix is two independent layers, per the sprint's own rule ("do not
-- rely on grants alone"):
--   1. Revoke PUBLIC/anon/authenticated EXECUTE, grant only service_role.
--   2. Belt-and-braces: the function itself now refuses to run unless the
--      calling role is service_role, so a future grant regression (e.g.
--      someone re-running the original migration, or a GRANT ALL ON ALL
--      FUNCTIONS script) fails closed instead of silently reopening this.

BEGIN;

REVOKE ALL ON FUNCTION public.provision_teacher_school(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.provision_teacher_school(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.provision_teacher_school(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.provision_teacher_school(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.provision_teacher_school(
  p_user_id uuid,
  p_school_name text
) RETURNS schools
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school schools;
  v_existing school_users;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'provision_teacher_school: service_role only' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'provision_teacher_school: p_user_id is required' USING ERRCODE = '22004';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('phase0_provision_teacher_school:' || p_user_id::text));

  SELECT * INTO v_existing
    FROM school_users
    WHERE user_id = p_user_id AND is_active = true
    ORDER BY created_at ASC
    LIMIT 1;

  IF FOUND THEN
    SELECT * INTO v_school FROM schools WHERE id = v_existing.school_id;
    RETURN v_school;
  END IF;

  INSERT INTO schools (school_name, created_by, provisioning_source)
  VALUES (p_school_name, p_user_id, 'teacher_first_write_auto_provision')
  RETURNING * INTO v_school;

  INSERT INTO school_users (school_id, user_id, role, invited_by, is_active)
  VALUES (v_school.id, p_user_id, 'school_admin', p_user_id, true);

  RETURN v_school;
END;
$$;

COMMIT;
