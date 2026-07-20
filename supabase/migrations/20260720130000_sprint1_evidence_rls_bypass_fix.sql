-- ═══════════════════════════════════════════════════════════════════════════════
-- Sprint 1 follow-up — learner_evidence RLS bypass fix
-- 2026-07-20
--
-- The policy added in 20260720120000_sprint1_critical_rls_fixes.sql joined
-- `students` directly inside its USING clause. Proven wrong by a live
-- integration test (lib/intelligence/evidenceAndBalanceRls.integration.test.ts):
-- `students` carries its own restrictive SELECT policy ("students: own read",
-- USING auth.uid() = user_id — a self-login student's own row only), so a
-- teacher's or parent's session cannot see the `students` row at all when it
-- is referenced from inside another table's policy — a classic Postgres RLS
-- trap: a policy that queries another RLS-protected table is still subject
-- to that table's own policies, even when called from a SECURITY INVOKER
-- context. The 'roster' half of the original policy worked (it queried
-- class_students/teacher_classes/teachers only, never `students`), but the
-- 'direct teacher_id link' and 'parent_user_id' halves silently returned
-- nothing for real data.
--
-- This codebase already has the correct fix pattern in production, applied in
-- 20260525_rls_policies.sql: SECURITY DEFINER helper functions that
-- deliberately bypass RLS on the tables *they* query (correct, because they
-- are only ever called *from* a policy, never queried directly by a client).
-- auth_is_teacher_of_student() already covers the roster case — reused
-- verbatim below, not duplicated. Two new helpers are added for the two gaps
-- that function doesn't cover: the direct students.teacher_id link, and
-- parent access.
--
-- Note on parent access: two parent-linkage mechanisms coexist in this schema
-- — students.parent_user_id (used by lib/compass/ownership.ts's
-- resolveParentOwnership) and class_students.parent_id (used by Sprint 14's
-- student_alerts fix). This is pre-existing schema drift, not introduced or
-- resolved here — auth_is_parent_of_student() treats both as equally
-- legitimate until that drift gets its own consolidation pass. A third
-- mechanism, student_guardians (via the existing auth_is_guardian_of()
-- helper), was checked and found to have zero write callers anywhere in the
-- codebase — dead, unused, deliberately not included here.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION auth_is_direct_teacher_of_student(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   students s
    JOIN   teachers t ON t.id = s.teacher_id
    WHERE  s.id = p_student_id
      AND  t.user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION auth_is_parent_of_student(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM students WHERE id = p_student_id AND parent_user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM class_students WHERE student_id = p_student_id AND parent_id = auth.uid()
  )
$$;

DROP POLICY IF EXISTS "learner_evidence: current teacher or parent read" ON learner_evidence;

CREATE POLICY "learner_evidence: current teacher or parent read"
  ON learner_evidence FOR SELECT
  USING (
    auth_is_direct_teacher_of_student(learner_id)
    OR auth_is_teacher_of_student(learner_id)
    OR auth_is_parent_of_student(learner_id)
  );

-- Rollback:
--   DROP POLICY IF EXISTS "learner_evidence: current teacher or parent read" ON learner_evidence;
--   CREATE POLICY "learner_evidence: current teacher or parent read"
--     ON learner_evidence FOR SELECT
--     USING (
--       learner_id IN (SELECT s.id FROM students s JOIN teachers t ON t.id = s.teacher_id WHERE t.user_id = auth.uid())
--       OR learner_id IN (SELECT cs.student_id FROM class_students cs JOIN teacher_classes tc ON tc.id = cs.class_id JOIN teachers t ON t.id = tc.teacher_id WHERE t.user_id = auth.uid())
--       OR learner_id IN (SELECT id FROM students WHERE parent_user_id = auth.uid())
--       OR learner_id IN (SELECT student_id FROM class_students WHERE parent_id = auth.uid())
--     );
--   DROP FUNCTION IF EXISTS auth_is_direct_teacher_of_student(UUID);
--   DROP FUNCTION IF EXISTS auth_is_parent_of_student(UUID);
