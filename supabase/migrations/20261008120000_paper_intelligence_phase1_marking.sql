-- Paper Intelligence Phase 1 — Commit 1 (schema).
--
-- Thin mobile marking slice. Three additive schema changes, no identity,
-- no new canonical domain, no touch to any deprecated/off-limits table
-- (CLAUDE.md / Architecture Guardian: extending existing feature surfaces,
-- not introducing a domain). Mirrors the open_response_rubrics /
-- paper_intelligence_failure_log precedents (Prototype 01) exactly:
-- teacher-scoped RLS keyed through assignments.teacher_id, reads/writes in
-- practice go through the service-role client in named API routes that do
-- their own requireClassTeacher() ownership check first.
--
-- 1. open_response_rubrics gains `accepted_answers` — the AI-extracted and
--    teacher-confirmed answer bank (Phase 0's rubric JSON had this; the
--    table did not). Also the write target for the "accept a
--    plausible_not_in_scheme answer → append to rubric" review action.
-- 2. assignment_submission_pages — a learner's script is multi-page and
--    answers span pages (Phase 0: Q5 started on p2, finished on p3).
--    assignment_submissions holds a single file_path, so pages live here.
-- 3. paper_intelligence_rubric_audit — SBA defensibility: every rubric
--    change (who, what, when, how many learners re-affected).

-- ── 1. accepted_answers on the existing rubric table (additive) ──────────
-- Structured list, e.g.
--   [{"text": "Patience", "synonyms": ["patient"], "mode": "accept_relevant",
--     "added_by": "teacher", "added_at": "2026-10-08T..."}]
-- Default [] keeps every existing row valid with no backfill.
ALTER TABLE open_response_rubrics
  ADD COLUMN IF NOT EXISTS accepted_answers jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ── 2. assignment_submission_pages ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS assignment_submission_pages (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  uuid        NOT NULL REFERENCES assignment_submissions(id) ON DELETE CASCADE,
  page_number    int         NOT NULL CHECK (page_number > 0),
  file_path      text        NOT NULL,
  file_type      text,
  -- 0..1 sharpness estimate recorded at capture; nullable (older/legacy
  -- captures, or when the client could not compute one). A low score is a
  -- retake prompt at the UI, never a silent drop.
  blur_score     numeric,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_assignment_submission_pages_submission_id
  ON assignment_submission_pages (submission_id);

ALTER TABLE assignment_submission_pages ENABLE ROW LEVEL SECURITY;

-- Teacher-only, scoped through the parent submission's assignment owner —
-- same shape as open_response_rubrics' own policy. No student/parent policy:
-- pages are teacher-captured during marking in this phase.
CREATE POLICY "assignment_submission_pages: teacher crud"
  ON assignment_submission_pages FOR ALL
  USING (
    submission_id IN (
      SELECT s.id FROM assignment_submissions s
      WHERE s.assignment_id IN (
        SELECT id FROM assignments
        WHERE teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
      )
    )
  )
  WITH CHECK (
    submission_id IN (
      SELECT s.id FROM assignment_submissions s
      WHERE s.assignment_id IN (
        SELECT id FROM assignments
        WHERE teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
      )
    )
  );

-- ── 3. paper_intelligence_rubric_audit ──────────────────────────────────
CREATE TABLE IF NOT EXISTS paper_intelligence_rubric_audit (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id           uuid        NOT NULL REFERENCES open_response_rubrics(id) ON DELETE CASCADE,
  assignment_id       uuid        NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  -- teachers.id, matching open_response_rubrics.created_by's identity space.
  actor_teacher_id    uuid        NOT NULL REFERENCES teachers(id),
  action              text        NOT NULL CHECK (action IN ('append_accepted_answer', 'edit_rubric')),
  -- the accepted answer appended (for append_accepted_answer); null otherwise.
  answer_added        jsonb,
  -- how many existing submissions the appended answer was re-applied to.
  learners_reaffected int         NOT NULL DEFAULT 0 CHECK (learners_reaffected >= 0),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pi_rubric_audit_rubric_id
  ON paper_intelligence_rubric_audit (rubric_id);
CREATE INDEX IF NOT EXISTS idx_pi_rubric_audit_assignment_id
  ON paper_intelligence_rubric_audit (assignment_id);
CREATE INDEX IF NOT EXISTS idx_pi_rubric_audit_actor_teacher_id
  ON paper_intelligence_rubric_audit (actor_teacher_id);

ALTER TABLE paper_intelligence_rubric_audit ENABLE ROW LEVEL SECURITY;

-- Teacher-only read/insert, scoped through the assignment owner. Audit rows
-- are append-only in practice (written by the service-role client in the
-- accept-answer route); no UPDATE/DELETE is ever issued against them.
CREATE POLICY "paper_intelligence_rubric_audit: teacher crud"
  ON paper_intelligence_rubric_audit FOR ALL
  USING (
    assignment_id IN (
      SELECT id FROM assignments
      WHERE teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    assignment_id IN (
      SELECT id FROM assignments
      WHERE teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
    )
  );
