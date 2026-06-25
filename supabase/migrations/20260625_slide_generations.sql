CREATE TABLE IF NOT EXISTS slide_generations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id   uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject      text NOT NULL,
  grade        text NOT NULL,
  topic        text NOT NULL,
  slides_count int  NOT NULL DEFAULT 10,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_slide_generations_teacher_id ON slide_generations(teacher_id);

ALTER TABLE slide_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view their own slide generations"
  ON slide_generations FOR SELECT
  USING (
    teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
  );

CREATE POLICY "Teachers can insert their own slide generations"
  ON slide_generations FOR INSERT
  WITH CHECK (
    teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
  );
