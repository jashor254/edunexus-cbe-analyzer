-- Teacher Reflection domain (Sprint 12O, ADR-0006 §6).
--
-- One canonical, teacher-authored, structured educational reflection per
-- learner per authoring cycle — never behaviour, discipline, counselling,
-- or AI-generated content. Storage audit (sprint-12o doc §1) confirmed no
-- existing table fits: `school_report_cards.class_teacher_comment` is a
-- term-scoped Report-Cards-owned field (reference-only, ADR-0005 §5), and
-- `learner_evidence` (Phase C teacher remarks) is a raw evidence-input
-- stream for the Projection Engine, not an authored narrative artifact —
-- neither is a duplicate of this table, both are deliberately left
-- untouched.

CREATE TABLE IF NOT EXISTS teacher_reflections (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Core learner identity, matching Blueprint Snapshots' own convention
  -- (Core-native from the start, never the legacy `students.id` space).
  learner_id            uuid        NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  school_id             uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  -- Attribution only (CLAUDE.md: teacher_id means "who entered this," never
  -- an access gate) — captured at creation and re-captured as
  -- `teacher_signature` at publish time so a published reflection's
  -- attribution survives the authoring teacher's membership row changing.
  teacher_id            uuid        REFERENCES school_users(id) ON DELETE SET NULL,

  -- One reflection cycle per learner increments this — never reused, never
  -- decremented. `findCurrent` reads the highest-versioned *published* row;
  -- a new cycle (e.g. next term) is a new row with version = previous + 1,
  -- never an edit of an old one.
  version               int         NOT NULL,

  strengths             text        NOT NULL,
  growth_area           text        NOT NULL,
  learning_habits       text        NOT NULL,
  recommended_support   text        NOT NULL,
  -- Optional — not every reflection cycle has a holiday adjacent to it.
  holiday_focus         text,

  status                text        NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft', 'published')),
  -- The teacher's own display name, captured verbatim at publish time —
  -- never re-derived from `teacher_id` later, so a published reflection's
  -- signature survives the teacher leaving the school.
  teacher_signature     text,
  written_at            timestamptz NOT NULL DEFAULT now(),
  published_at          timestamptz,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE (learner_id, version)
);

CREATE INDEX IF NOT EXISTS idx_teacher_reflections_learner_id ON teacher_reflections (learner_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_teacher_reflections_school_id  ON teacher_reflections (school_id);

ALTER TABLE teacher_reflections ENABLE ROW LEVEL SECURITY;

-- School-isolation only, matching blueprint_snapshots' convention — RLS
-- enforces the tenant boundary; the service layer (lib/teacherReflection/)
-- enforces the finer rule that Blueprint/most callers only ever see
-- *published* rows via `findCurrent`/`history`. No write policy for the
-- `authenticated` role — every write goes through the service-role client.
CREATE POLICY "teacher_reflections_school_staff_read"
  ON teacher_reflections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = teacher_reflections.school_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

-- Immutability after publication, enforced by the database (mirrors
-- `learner_evidence` and `blueprint_snapshots`' own trigger-enforced
-- immutability — CLAUDE.md: "never mutated after creation... enforced by
-- a database trigger, not just this rule"). Conditional, unlike Blueprint
-- Snapshots: a draft is legitimately editable (Phase 5's "Teacher
-- Editing" stage) — only a row that is *already* published may never be
-- changed again, by any client, including the service role.
CREATE OR REPLACE FUNCTION enforce_teacher_reflection_immutability() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'published' THEN
    RAISE EXCEPTION 'teacher_reflections row % is published and immutable (Sprint 12O, Phase 5). Publish a new version instead of editing this one.', OLD.id;
  END IF;
  -- NEW is NULL in a DELETE trigger context — returning it would silently
  -- cancel a legitimate draft delete instead of allowing it.
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_teacher_reflections_no_edit_after_publish
  BEFORE UPDATE ON teacher_reflections
  FOR EACH ROW EXECUTE FUNCTION enforce_teacher_reflection_immutability();

CREATE TRIGGER trg_teacher_reflections_no_delete_after_publish
  BEFORE DELETE ON teacher_reflections
  FOR EACH ROW EXECUTE FUNCTION enforce_teacher_reflection_immutability();

CREATE OR REPLACE FUNCTION set_teacher_reflections_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_teacher_reflections_updated_at
  BEFORE UPDATE ON teacher_reflections
  FOR EACH ROW EXECUTE FUNCTION set_teacher_reflections_updated_at();
