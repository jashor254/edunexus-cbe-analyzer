-- Holiday plans are computed the moment a teacher clicks "generate", but
-- nothing should reach a parent (via the Learner Blueprint) until the
-- teacher reviews it. Defaults to false for both new and existing rows —
-- no pre-existing row was ever shown to a parent through any read path, so
-- there is nothing to preserve by defaulting to true.
ALTER TABLE holiday_plans
  ADD COLUMN is_published BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN published_at TIMESTAMPTZ;

CREATE INDEX idx_holiday_plans_published ON holiday_plans(student_id, is_published);
