-- LMS Basics Phase 2 — Class Calendar + Announcements (ADR-0021). Same
-- legacy teacher_classes/class_students identity space as every other LMS
-- Basics table (class_resources, course_materials, assignments).

CREATE TABLE IF NOT EXISTS class_calendar_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    uuid        NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
  teacher_id  uuid        NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  description text,
  event_date  date        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_class_calendar_events_class_id   ON class_calendar_events (class_id, event_date);
CREATE INDEX IF NOT EXISTS idx_class_calendar_events_teacher_id ON class_calendar_events (teacher_id);

CREATE TABLE IF NOT EXISTS class_announcements (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    uuid        NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
  teacher_id  uuid        NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  body        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_class_announcements_class_id   ON class_announcements (class_id, created_at);
CREATE INDEX IF NOT EXISTS idx_class_announcements_teacher_id ON class_announcements (teacher_id);

ALTER TABLE class_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_announcements  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_calendar_events: teacher crud"
  ON class_calendar_events FOR ALL
  USING (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()))
  WITH CHECK (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()));

CREATE POLICY "class_announcements: teacher crud"
  ON class_announcements FOR ALL
  USING (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()))
  WITH CHECK (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()));

-- Student/parent read, gated on CURRENT class membership (class_students),
-- never on who authored the row — same rule applied in ADR-0020's tables.
CREATE POLICY "class_calendar_events: student/parent read"
  ON class_calendar_events FOR SELECT
  USING (
    class_id IN (
      SELECT class_id FROM class_students
      WHERE student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
         OR parent_id = auth.uid()
    )
  );

CREATE POLICY "class_announcements: student/parent read"
  ON class_announcements FOR SELECT
  USING (
    class_id IN (
      SELECT class_id FROM class_students
      WHERE student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
         OR parent_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION set_class_calendar_events_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_class_calendar_events_updated_at
  BEFORE UPDATE ON class_calendar_events
  FOR EACH ROW EXECUTE FUNCTION set_class_calendar_events_updated_at();

CREATE TRIGGER trg_class_announcements_updated_at
  BEFORE UPDATE ON class_announcements
  FOR EACH ROW EXECUTE FUNCTION set_class_calendar_events_updated_at();
