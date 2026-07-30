-- Printable Adaptive Assignments — pilot (Adaptive Assignment Domain audit,
-- CONDITIONAL GO). Purely additive to the existing LMS `assignments` domain
-- — no new identity, no second Assignment domain, no Core-schema migration.
-- Reuses the legacy teachers/teacher_classes/class_students/students
-- identity space every other assignment-domain table already runs on.
--
-- Audit performed before writing this migration: no existing table can
-- hold both "the approved printable content" and "the learner routing used
-- for that print run" together. `blueprint_snapshots` is the closest
-- precedent (immutable-once-written, jsonb payload) but is Core
-- `learners.id`-scoped and Blueprint-owned exclusively — wrong identity
-- space and wrong domain to extend. `assignment_question_variants` is the
-- closest *tiering* precedent (foundation/supported_practice/extension,
-- draft->approved lifecycle) but is per-question, quiz-only, and has no
-- concept of a "run" or a roster-wide routing decision. Two new,
-- single-purpose tables are genuinely required.
--
-- Two tables:
--   assignment_print_runs   — one row per "Prepare Printable Routes"
--                              generation for one assignment. Freezes BOTH
--                              the assignment content used to generate
--                              (assignment_snapshot) AND the three approved
--                              route bodies (route_content) once approved —
--                              never relies on regenerating later from
--                              current assignment data.
--   assignment_print_routes — one row per learner per print run: which
--                              route they were routed to, whether that was
--                              system-suggested or teacher-overridden, and
--                              the evidence band that produced the
--                              suggestion. A route is a property of ONE
--                              print run, never a standing learner
--                              attribute — this table has no "current
--                              route" column anywhere else in the schema.

CREATE TABLE IF NOT EXISTS assignment_print_runs (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id            uuid        NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  status                   text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'superseded')),
  -- The assignment's own title/subject/topic/instructions/due_date/max_score
  -- exactly as they were at generation time — so an approved run remains
  -- correct and reproducible even if the teacher later edits the assignment.
  assignment_snapshot      jsonb       NOT NULL,
  -- {guided: {...}, core: {...}, extension: {...}} — the exact approved
  -- printable content per route. Frozen once approved (trigger below).
  route_content            jsonb       NOT NULL,
  -- Names which deterministic generation logic produced route_content —
  -- lib/assignments/printRoutes.ts's own version tag, so a future change to
  -- that generator never silently reinterprets an old, already-approved run.
  adaptation_version       text        NOT NULL DEFAULT 'print-routes-v1',
  generated_at             timestamptz NOT NULL DEFAULT now(),
  generated_by             uuid        NOT NULL REFERENCES teachers(id),
  approved_at              timestamptz,
  approved_by              uuid        REFERENCES teachers(id),
  -- Regeneration produces a NEW row referencing the one it replaces — the
  -- old row is marked 'superseded', never deleted, never overwritten.
  supersedes_print_run_id  uuid        REFERENCES assignment_print_runs(id),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignment_print_runs_assignment_id
  ON assignment_print_runs (assignment_id, created_at DESC);

CREATE TABLE IF NOT EXISTS assignment_print_routes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  print_run_id   uuid        NOT NULL REFERENCES assignment_print_runs(id) ON DELETE CASCADE,
  student_id     uuid        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  route          text        NOT NULL CHECK (route IN ('guided', 'core', 'extension')),
  source         text        NOT NULL CHECK (source IN ('system_suggested', 'teacher_override')),
  -- The internal adaptive-learning taxonomy value that produced the
  -- suggestion (lib/adaptiveLearning/recommend.ts's AdaptiveGroupType) —
  -- teacher-only via RLS below, never returned by any student/parent route.
  -- Null when a per-learner projection lookup itself failed (routed to
  -- 'core' regardless, per the locked routing rule).
  evidence_band  text        CHECK (evidence_band IN ('critical_gap', 'prerequisite_gap', 'concept_confusion', 'on_track', 'insufficient_data')),
  -- One human-readable sentence explaining the suggestion to the teacher
  -- (e.g. "Level 2 in Mathematics, declining") — never a raw percentage,
  -- never an evidence ID. Null when evidence_band is null.
  evidence_note  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  -- One row per learner per print run — never duplicated, never a standing
  -- attribute reused across runs.
  UNIQUE (print_run_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_assignment_print_routes_print_run_id ON assignment_print_routes (print_run_id);
CREATE INDEX IF NOT EXISTS idx_assignment_print_routes_student_id ON assignment_print_routes (student_id);

ALTER TABLE assignment_print_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_print_routes ENABLE ROW LEVEL SECURITY;

-- Teacher-only, ownership via the parent assignment's teacher_id — same
-- shape as assignments' own "assignments: teacher manage" policy and
-- assignment_question_variants' teacher-only policy. Deliberately NO
-- student or parent SELECT policy on either table: learner routing must
-- never be exposed through a student or parent API (locked requirement).
CREATE POLICY "assignment_print_runs: teacher manage"
  ON assignment_print_runs FOR ALL
  USING (
    assignment_id IN (
      SELECT id FROM assignments WHERE teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "assignment_print_routes: teacher manage"
  ON assignment_print_routes FOR ALL
  USING (
    print_run_id IN (
      SELECT apr.id FROM assignment_print_runs apr
      JOIN assignments a ON a.id = apr.assignment_id
      WHERE a.teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
    )
  );

-- Immutability once approved — enforced by the database, mirroring
-- blueprint_snapshots' and learner_evidence's own trigger-enforced
-- discipline, not just application code. An approved run's content/
-- provenance may never change; the ONLY permitted post-approval write is
-- flipping status to 'superseded' when a later print run replaces it
-- (regeneration inserts a new row rather than mutating this one).
CREATE OR REPLACE FUNCTION enforce_approved_print_run_immutability() RETURNS trigger AS $$
BEGIN
  IF OLD.approved_at IS NOT NULL THEN
    IF NEW.assignment_snapshot IS DISTINCT FROM OLD.assignment_snapshot
       OR NEW.route_content   IS DISTINCT FROM OLD.route_content
       OR NEW.approved_at     IS DISTINCT FROM OLD.approved_at
       OR NEW.approved_by     IS DISTINCT FROM OLD.approved_by
       OR NEW.generated_by    IS DISTINCT FROM OLD.generated_by
       OR NEW.assignment_id   IS DISTINCT FROM OLD.assignment_id
    THEN
      RAISE EXCEPTION 'assignment_print_runs row % is approved and immutable — regenerate a new print run instead of editing this one', OLD.id;
    END IF;
    IF NEW.status NOT IN ('approved', 'superseded') THEN
      RAISE EXCEPTION 'an approved assignment_print_runs row may only ever transition to superseded';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_assignment_print_runs_immutable_once_approved
  BEFORE UPDATE ON assignment_print_runs
  FOR EACH ROW EXECUTE FUNCTION enforce_approved_print_run_immutability();
