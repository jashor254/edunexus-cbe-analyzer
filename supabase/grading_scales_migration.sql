-- ── teacher_grade_scales ─────────────────────────────────────────────────
-- Stores custom grading scales defined by each teacher.
-- bands JSONB: [{label, minPct, maxPct, colorCls}] sorted highest → lowest.

CREATE TABLE IF NOT EXISTS teacher_grade_scales (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      uuid        NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  curriculum_hint text        NOT NULL DEFAULT 'cbc'
                              CHECK (curriculum_hint IN ('cbc', '844', 'custom')),
  bands           jsonb       NOT NULL DEFAULT '[]',
  is_default      boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_grade_scales_teacher_id
  ON teacher_grade_scales(teacher_id);

ALTER TABLE teacher_grade_scales ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'teacher_grade_scales' AND policyname = 'teacher_grade_scales_rw'
  ) THEN
    CREATE POLICY "teacher_grade_scales_rw"
      ON teacher_grade_scales
      USING      (teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid()))
      WITH CHECK (teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid()));
  END IF;
END $$;

-- ── class_assessments: add grade_scale_id ────────────────────────────────
ALTER TABLE class_assessments
  ADD COLUMN IF NOT EXISTS grade_scale_id uuid
    REFERENCES teacher_grade_scales(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_class_assessments_grade_scale_id
  ON class_assessments(grade_scale_id)
  WHERE grade_scale_id IS NOT NULL;
