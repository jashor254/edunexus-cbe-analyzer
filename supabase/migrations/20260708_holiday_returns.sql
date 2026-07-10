-- Holiday Return intake (Adaptive Learning v2 Architecture §4/§7/§10,
-- docs/architecture/adaptive-learning-v2-architecture.md, FROZEN) — the
-- operational tracking row for a returned holiday pack (which weeks came
-- back, teacher comment), separate from the academic/engagement claims
-- themselves (those are Evidence, in learner_evidence, via
-- lib/holiday/return.ts). This table answers "did the pack come back and
-- what did the teacher note," not "what does this mean about the
-- learner" — that question is Projection's, derived from the Evidence
-- this same intake produces.

CREATE TABLE IF NOT EXISTS holiday_returns (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id       uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  ingestion_run_id uuid REFERENCES ingestion_runs(id) ON DELETE SET NULL,
  term             integer NOT NULL,
  year             integer NOT NULL,
  weeks_assigned   integer NOT NULL,
  weeks_completed  integer NOT NULL,
  teacher_comment  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, term, year)
);

CREATE INDEX IF NOT EXISTS idx_holiday_returns_teacher_id ON holiday_returns (teacher_id);
CREATE INDEX IF NOT EXISTS idx_holiday_returns_student_id ON holiday_returns (student_id);

ALTER TABLE holiday_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own holiday returns"
  ON holiday_returns FOR ALL
  USING (teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid()))
  WITH CHECK (teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid()));
