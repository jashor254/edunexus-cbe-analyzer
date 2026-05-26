-- ============================================================
-- Stream / Grade Cohort + Mean Grade Migration
-- ============================================================

-- Task 10: Stream columns on teacher_classes
ALTER TABLE teacher_classes
  ADD COLUMN IF NOT EXISTS stream       text,
  ADD COLUMN IF NOT EXISTS grade_cohort text;

-- Back-fill existing rows so grade_cohort is never null
UPDATE teacher_classes
  SET grade_cohort = 'Grade ' || grade
  WHERE grade_cohort IS NULL;

-- Task 11: Mean score/grade on learner_marks
ALTER TABLE learner_marks
  ADD COLUMN IF NOT EXISTS mean_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS mean_grade text;

-- Curriculum type on class_assessments (defaults to CBC)
ALTER TABLE class_assessments
  ADD COLUMN IF NOT EXISTS curriculum_type text DEFAULT 'cbc'
  CHECK (curriculum_type IN ('cbc', '844'));

-- Index for cohort lookups
CREATE INDEX IF NOT EXISTS idx_teacher_classes_grade_cohort
  ON teacher_classes(teacher_id, grade_cohort);
