-- LMS Basics Phase 1a/1b — Class Resources (file sharing) + Content Library
-- (structured notes). ADR-0020. Built on the legacy teacher_classes/
-- class_students FK space, matching assignments/assessments/attendance —
-- the identity space every teacher-facing feature actually runs on today
-- (confirmed live in assessment.repository.ts comments), not the newer
-- learners/school_users schema, which is scoped to the showcase domains
-- only.

CREATE TABLE IF NOT EXISTS class_resources (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    uuid        NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
  teacher_id  uuid        NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  file_path   text        NOT NULL,
  file_name   text        NOT NULL,
  file_type   text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_class_resources_class_id   ON class_resources (class_id);
CREATE INDEX IF NOT EXISTS idx_class_resources_teacher_id ON class_resources (teacher_id);

CREATE TABLE IF NOT EXISTS course_materials (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    uuid        NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
  teacher_id  uuid        NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  body        text        NOT NULL,
  link_url    text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_materials_class_id   ON course_materials (class_id);
CREATE INDEX IF NOT EXISTS idx_course_materials_teacher_id ON course_materials (teacher_id);

ALTER TABLE class_resources   ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_materials  ENABLE ROW LEVEL SECURITY;

-- Teacher: full CRUD on rows they own.
CREATE POLICY "class_resources: teacher crud"
  ON class_resources FOR ALL
  USING (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()))
  WITH CHECK (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()));

CREATE POLICY "course_materials: teacher crud"
  ON course_materials FOR ALL
  USING (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()))
  WITH CHECK (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()));

-- Student/parent: read-only, gated on CURRENT class membership
-- (class_students), never on who uploaded the row — CLAUDE.md's evidence
-- access-control rule applied generally: teacher_id means "who entered
-- this," never "who may read this."
CREATE POLICY "class_resources: student/parent read"
  ON class_resources FOR SELECT
  USING (
    class_id IN (
      SELECT class_id FROM class_students
      WHERE student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
         OR parent_id = auth.uid()
    )
  );

CREATE POLICY "course_materials: student/parent read"
  ON course_materials FOR SELECT
  USING (
    class_id IN (
      SELECT class_id FROM class_students
      WHERE student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
         OR parent_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION set_class_resources_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_class_resources_updated_at
  BEFORE UPDATE ON class_resources
  FOR EACH ROW EXECUTE FUNCTION set_class_resources_updated_at();

CREATE TRIGGER trg_course_materials_updated_at
  BEFORE UPDATE ON course_materials
  FOR EACH ROW EXECUTE FUNCTION set_class_resources_updated_at();

INSERT INTO storage.buckets (id, name, public)
VALUES ('class-resources', 'class-resources', false)
ON CONFLICT (id) DO NOTHING;

-- No storage.objects policy for anon/authenticated — same posture as
-- clinic-reports and assignment-submissions: access only through the
-- service-role client in a named, ownership-checked API route.
