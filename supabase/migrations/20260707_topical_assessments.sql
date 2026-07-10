-- Extend strand_assessments to support standalone topical checks, distinct
-- from the legacy per-term `assessments` parent row it was originally tied to.
-- assessment_id becomes optional: topical checks are recorded directly
-- against a class/teacher/term, not a full multi-subject assessment event.

ALTER TABLE strand_assessments
  ALTER COLUMN assessment_id DROP NOT NULL,
  ADD COLUMN class_id   UUID REFERENCES teacher_classes(id) ON DELETE CASCADE,
  ADD COLUMN teacher_id UUID REFERENCES teachers(id)        ON DELETE CASCADE,
  ADD COLUMN term       INTEGER CHECK (term BETWEEN 1 AND 3),
  ADD COLUMN year       INTEGER CHECK (year >= 2020),
  ADD COLUMN source     TEXT NOT NULL DEFAULT 'topical_check'
                             CHECK (source IN ('topical_check', 'term_assessment'));

ALTER TABLE strand_assessments
  ADD CONSTRAINT strand_assessments_has_parent
    CHECK (assessment_id IS NOT NULL OR (class_id IS NOT NULL AND teacher_id IS NOT NULL));

CREATE INDEX idx_strand_assessments_class_id   ON strand_assessments(class_id);
CREATE INDEX idx_strand_assessments_teacher_id ON strand_assessments(teacher_id);

-- Teacher-side writes go through the service-role client after the API route
-- verifies class ownership (same pattern as class_assessments/learner_marks),
-- so no teacher-facing RLS insert policy is added here — existing "own"
-- policies remain scoped to the student/parent read path.
