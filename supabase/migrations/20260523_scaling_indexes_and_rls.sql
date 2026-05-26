-- 20260523_scaling_indexes_and_rls.sql
--
-- Adds missing indexes identified during scaling audit and tightens the
-- class_students read policy which previously allowed anyone to enumerate
-- which students belong to which class.
--
-- Rollback:
--   DROP INDEX IF EXISTS idx_learner_marks_assessment_teacher;
--   DROP INDEX IF EXISTS idx_teacher_classes_grade_cohort;
--   DROP INDEX IF EXISTS idx_ai_usage_logs_created_at;
--   DROP POLICY IF EXISTS "class_students: read" ON class_students;
--   CREATE POLICY "class_students: read" ON class_students FOR SELECT USING (TRUE);

BEGIN;

-- Composite index used by cohort queries and attachStats batch fetches.
-- Both getCohortData() and getClassAssessments() filter on (assessment_id, teacher_id).
CREATE INDEX IF NOT EXISTS idx_learner_marks_assessment_teacher
  ON learner_marks(assessment_id, teacher_id);

-- Index for grade cohort grouping used in getCohortData() and getTeacherCohorts().
CREATE INDEX IF NOT EXISTS idx_teacher_classes_grade_cohort
  ON teacher_classes(grade_cohort);

-- Index for date-range scans in checkAIRateLimit() which filters on
-- (user_id, created_at >= today). The existing idx_ai_usage_user_date
-- covers (user_id, created_at) but this standalone index covers cross-user
-- admin queries and future analytics.
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at
  ON ai_usage_logs(created_at);

-- Tighten class_students read policy.
-- Old policy: USING (TRUE) — anyone authenticated could enumerate all class memberships.
-- New policy: only the parent who enrolled the student, or the teacher who owns the class.
DROP POLICY IF EXISTS "class_students: read" ON class_students;

CREATE POLICY "class_students: read"
  ON class_students FOR SELECT
  USING (
    parent_id = auth.uid()
    OR class_id IN (
      SELECT tc.id
      FROM teacher_classes tc
      JOIN teachers t ON t.id = tc.teacher_id
      WHERE t.user_id = auth.uid()
    )
  );

COMMIT;
