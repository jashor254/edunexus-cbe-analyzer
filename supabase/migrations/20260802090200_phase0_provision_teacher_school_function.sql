-- Phase 0 — atomic provisional-school provisioning.
--
-- Concurrency guarantee (Step 3): an application-level "check school_users,
-- then insert schools+school_users" is NOT atomic — two simultaneous first
-- writes from the same user's two concurrent requests can both pass the
-- check before either insert commits, producing two schools. This function
-- makes the check-then-insert atomic inside one transaction, guarded by a
-- transaction-scoped advisory lock keyed on the user id
-- (pg_advisory_xact_lock — auto-released at commit/rollback, safe even if
-- the connection dies mid-transaction, unlike a session-scoped lock that
-- would require explicit unlock).
--
-- Double-checked-locking shape: re-select for an existing active
-- school_users row *after* acquiring the lock, not just before — so a
-- second concurrent caller that waited on the lock sees the first caller's
-- committed row and returns it instead of creating a duplicate, even though
-- both callers passed the same "no membership yet" check before either
-- held the lock.
CREATE OR REPLACE FUNCTION provision_teacher_school(
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

GRANT EXECUTE ON FUNCTION provision_teacher_school(uuid, text) TO service_role;
