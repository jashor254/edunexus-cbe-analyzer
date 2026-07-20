-- Sprint 9 Slice 3 — atomic, write-once served-variant resolution.
--
-- A single UPDATE statement, guarded by jsonb key-existence, is Postgres's
-- standard safe upsert-merge pattern: under the default READ COMMITTED
-- isolation level, a second concurrent UPDATE targeting the same row blocks
-- on the row lock until the first commits, then re-evaluates its own SET
-- subquery and WHERE clause against the now-current (post-commit) row
-- (EvalPlanQual) — so the second call only ever merges keys the first call
-- didn't already claim. No explicit FOR UPDATE locking needed; the single
-- UPDATE statement is itself the atomic unit.
--
-- p_pairs is a jsonb object of {questionId: variantId | null} — null is a
-- real, sticky value (an honest "no approved variant, serving canonical"
-- resolution that must never be re-attempted on a later open, not an
-- absent key). Returns the full, authoritative served_variant_map after
-- the merge — whichever concurrent caller's value actually won for each key.
CREATE OR REPLACE FUNCTION resolve_served_variants_batch(
  p_assignment_id uuid,
  p_student_id    uuid,
  p_pairs         jsonb
) RETURNS jsonb AS $$
DECLARE
  v_map jsonb;
BEGIN
  UPDATE assignment_submissions
  SET served_variant_map = COALESCE(served_variant_map, '{}'::jsonb) || COALESCE((
    SELECT jsonb_object_agg(pair.key, pair.value)
    FROM jsonb_each(p_pairs) AS pair
    WHERE NOT (COALESCE(assignment_submissions.served_variant_map, '{}'::jsonb) ? pair.key)
  ), '{}'::jsonb)
  WHERE assignment_id = p_assignment_id AND student_id = p_student_id
  RETURNING served_variant_map INTO v_map;

  IF v_map IS NULL THEN
    RAISE EXCEPTION 'No assignment_submissions row for assignment % / student % — cannot resolve served variants', p_assignment_id, p_student_id;
  END IF;

  RETURN v_map;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;
