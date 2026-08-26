-- Senior School Programme Truth — atomic write function.
--
-- supabase-js has no cross-statement transaction API from the client, and a
-- programme write here is genuinely multi-step: close the learner's current
-- programme (if any), insert the new one, re-point the old row's
-- superseded_by_programme_id, then insert every subject membership row.
-- Doing that as separate client-side calls risks leaving a learner with NO
-- current programme if a later step fails (the old row already closed, no
-- new row committed) — exactly the kind of silent data loss this phase's
-- spec prohibits ("no destructive overwrite of old subject membership").
-- A single plpgsql function gives us one implicit transaction for the whole
-- operation instead.
--
-- Access: EXECUTE is revoked from PUBLIC/anon/authenticated and granted only
-- to service_role. This function is the one canonical write boundary
-- (lib/curriculum/seniorProgramme.ts calls it via the service-role client);
-- no page/route may write learner_programmes/learner_programme_subjects
-- directly. Restricting the grant this way also avoids adding a new
-- "Public Can Execute SECURITY DEFINER Function" advisory finding of the
-- kind already present on other functions in this project.

BEGIN;

CREATE OR REPLACE FUNCTION create_or_update_senior_programme(
  p_learner_id                   uuid,
  p_school_id                    uuid,
  p_academic_year_id             uuid,
  p_curriculum_policy_version_id uuid,
  p_pathway                      text,
  p_track                        text,
  p_combination_code             text,
  p_source                       text,
  p_created_by                   uuid,
  p_subject_memberships          jsonb  -- [{ "subject_id": uuid, "role": text, "reason": text|null }, ...]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_old_programme_id uuid;
  v_new_programme_id uuid;
  v_member jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM learners WHERE id = p_learner_id AND school_id = p_school_id) THEN
    RAISE EXCEPTION 'learner % does not belong to school %', p_learner_id, p_school_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM academic_years WHERE id = p_academic_year_id AND school_id = p_school_id) THEN
    RAISE EXCEPTION 'academic year % does not belong to school %', p_academic_year_id, p_school_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF jsonb_array_length(p_subject_memberships) <> (
    SELECT count(DISTINCT elem->>'subject_id') FROM jsonb_array_elements(p_subject_memberships) elem
  ) THEN
    RAISE EXCEPTION 'duplicate subject_id within a single programme write'
      USING ERRCODE = 'unique_violation';
  END IF;

  -- Close the current programme, if one exists, before inserting the new
  -- one — the partial unique index (superseded_at IS NULL per learner_id)
  -- would otherwise reject the insert below.
  SELECT id INTO v_old_programme_id
  FROM learner_programmes
  WHERE learner_id = p_learner_id AND superseded_at IS NULL;

  IF v_old_programme_id IS NOT NULL THEN
    UPDATE learner_programmes SET superseded_at = now() WHERE id = v_old_programme_id;
  END IF;

  INSERT INTO learner_programmes (
    learner_id, school_id, academic_year_id, curriculum_policy_version_id,
    pathway, track, combination_code, source, created_by
  ) VALUES (
    p_learner_id, p_school_id, p_academic_year_id, p_curriculum_policy_version_id,
    p_pathway, p_track, p_combination_code, p_source, p_created_by
  )
  RETURNING id INTO v_new_programme_id;

  IF v_old_programme_id IS NOT NULL THEN
    UPDATE learner_programmes SET superseded_by_programme_id = v_new_programme_id WHERE id = v_old_programme_id;
  END IF;

  FOR v_member IN SELECT * FROM jsonb_array_elements(p_subject_memberships)
  LOOP
    INSERT INTO learner_programme_subjects (programme_id, subject_id, role, reason)
    VALUES (
      v_new_programme_id,
      (v_member->>'subject_id')::uuid,
      COALESCE(v_member->>'role', 'elective'),
      v_member->>'reason'
    );
  END LOOP;

  RETURN v_new_programme_id;
END;
$$;

REVOKE ALL ON FUNCTION create_or_update_senior_programme FROM PUBLIC;
REVOKE ALL ON FUNCTION create_or_update_senior_programme FROM anon;
REVOKE ALL ON FUNCTION create_or_update_senior_programme FROM authenticated;
GRANT EXECUTE ON FUNCTION create_or_update_senior_programme TO service_role;

COMMENT ON FUNCTION create_or_update_senior_programme IS
  'The one canonical write boundary for learner_programmes/learner_programme_subjects. Runs as one implicit transaction: closes the learner''s current programme (if any), inserts the new one, re-links superseded_by_programme_id, inserts subject memberships. service_role only — called from lib/curriculum/seniorProgramme.ts, never from a client-side query builder.';

COMMIT;
