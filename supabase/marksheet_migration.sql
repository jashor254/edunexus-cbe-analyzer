-- ============================================================
-- Marksheet System Migration
-- class_assessments + learner_marks
-- ============================================================

CREATE TABLE IF NOT EXISTS class_assessments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id        uuid        REFERENCES teacher_classes(id) ON DELETE CASCADE,
  teacher_id      uuid        NOT NULL    REFERENCES teachers(id) ON DELETE CASCADE,
  title           text        NOT NULL,
  assessment_type text        DEFAULT 'exam'
                  CHECK (assessment_type IN ('exam','cat','midterm','endterm','opener','assignment')),
  term            text        NOT NULL CHECK (term IN ('1','2','3')),
  year            integer     NOT NULL,
  max_score       integer     DEFAULT 100,
  subjects        text[]      NOT NULL DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learner_marks (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id    uuid        NOT NULL REFERENCES class_assessments(id) ON DELETE CASCADE,
  class_id         uuid        NOT NULL REFERENCES teacher_classes(id)   ON DELETE CASCADE,
  teacher_id       uuid        NOT NULL REFERENCES teachers(id)          ON DELETE CASCADE,
  student_name     text        NOT NULL,
  admission_number text,
  subject_scores   jsonb       NOT NULL DEFAULT '{}',
  total_marks      integer,
  position         integer,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_class_assessments_class_id   ON class_assessments(class_id);
CREATE INDEX IF NOT EXISTS idx_class_assessments_teacher_id ON class_assessments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_learner_marks_assessment_id  ON learner_marks(assessment_id);
CREATE INDEX IF NOT EXISTS idx_learner_marks_class_id       ON learner_marks(class_id);
CREATE INDEX IF NOT EXISTS idx_learner_marks_teacher_id     ON learner_marks(teacher_id);

-- RLS
ALTER TABLE class_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE learner_marks     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own assessments" ON class_assessments
  FOR ALL USING (
    teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
  );

CREATE POLICY "Teachers manage own marks" ON learner_marks
  FOR ALL USING (
    teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
  );
