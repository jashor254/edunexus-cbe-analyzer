-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase A — Class Archival + Promotion History
-- 2026-07-13
--
-- Implements docs/architecture/academic-evidence-layer.md §2 (Rules 1+2:
-- learner permanence, class archival) as real schema. Additive only: no
-- existing table is redesigned, no existing row is touched.
--
--   1. teacher_classes.status/archived_at — a class is archived, never
--      deleted, at year-end. Defaults to 'active' so every existing class
--      keeps behaving exactly as before until something explicitly
--      archives it.
--   2. student_promotions — one append-only row per promotion event. The
--      source of truth for "how did this student get here," distinct
--      from students.grade (kept as the fast-read current value, unchanged
--      by this migration).
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE teacher_classes
  ADD COLUMN IF NOT EXISTS status      text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_teacher_classes_status ON teacher_classes (status);

CREATE TABLE IF NOT EXISTS student_promotions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid        NOT NULL REFERENCES students(id),
  from_grade    integer,                                   -- null for first-ever enrollment
  to_grade      integer     NOT NULL,
  from_class_id uuid        REFERENCES teacher_classes(id),
  to_class_id   uuid        REFERENCES teacher_classes(id),
  academic_year text        NOT NULL,
  promoted_by   uuid        REFERENCES auth.users(id),
  promoted_at   timestamptz NOT NULL DEFAULT now(),
  notes         text
);

CREATE INDEX IF NOT EXISTS idx_student_promotions_student_id ON student_promotions (student_id);
CREATE INDEX IF NOT EXISTS idx_student_promotions_promoted_at ON student_promotions (promoted_at);

ALTER TABLE student_promotions ENABLE ROW LEVEL SECURITY;

-- A promotion is visible to the teacher who performed it, and to any
-- teacher currently teaching the student (same visibility shape as
-- class_students — a promotion record is a fact about the student's
-- history, not owned by the promoting teacher forever).
CREATE POLICY "student_promotions_visible_to_involved_teachers"
  ON student_promotions FOR SELECT
  USING (
    promoted_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM class_students cs
      JOIN teacher_classes tc ON tc.id = cs.class_id
      JOIN teachers t ON t.id = tc.teacher_id
      WHERE cs.student_id = student_promotions.student_id
        AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "student_promotions_insert_by_authenticated_teacher"
  ON student_promotions FOR INSERT
  WITH CHECK (promoted_by = auth.uid());

-- Append-only — no update or delete policy is granted, matching
-- evidence_audit_log's precedent (20260707_evidence_domain.sql) for
-- permanent historical records.
REVOKE UPDATE, DELETE ON student_promotions FROM authenticated, anon;
