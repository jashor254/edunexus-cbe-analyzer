-- Developer-platform sync pipeline: lets a school's existing system (via a
-- custom webhook/API integration_connection) push roster + grade data into
-- EduNexus idempotently, keyed by the school's own external_id, instead of
-- duplicating rows on every sync.

-- Which EduNexus teacher a connection's synced data belongs to. Resolved
-- server-side from a teacher_email at connection-creation time — nullable
-- until then; the sync endpoint refuses to run without it.
ALTER TABLE integration_connections
  ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES teachers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_integration_connections_teacher_id
  ON integration_connections (teacher_id);

-- external_id + integration_connection_id let repeated syncs upsert against
-- the school's own IDs instead of creating duplicate classes/students/
-- assessments every time the sync runs.
ALTER TABLE teacher_classes
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS integration_connection_id uuid REFERENCES integration_connections(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_classes_connection_external
  ON teacher_classes (integration_connection_id, external_id)
  WHERE integration_connection_id IS NOT NULL AND external_id IS NOT NULL;

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS integration_connection_id uuid REFERENCES integration_connections(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_students_connection_external
  ON students (integration_connection_id, external_id)
  WHERE integration_connection_id IS NOT NULL AND external_id IS NOT NULL;

ALTER TABLE class_assessments
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS integration_connection_id uuid REFERENCES integration_connections(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_class_assessments_connection_external
  ON class_assessments (integration_connection_id, external_id)
  WHERE integration_connection_id IS NOT NULL AND external_id IS NOT NULL;
