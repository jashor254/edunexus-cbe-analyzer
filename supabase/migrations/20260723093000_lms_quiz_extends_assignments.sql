-- LMS Basics Phase 3a — auto-graded MCQ quiz, built as an extension of the
-- existing Assignments domain rather than a new canonical domain (Guardian
-- Mode: extend, don't duplicate). No ADR needed — no new identity, no new
-- repository responsibility, just a bounded child table plus two columns.
--
-- Kenya-classroom-shaped scope: teachers already run quick MCQ revision
-- quizzes and CATs by hand-marking paper; this removes the marking step
-- for that specific, extremely common case. Deliberately NOT a general
-- question-bank/reuse system — one quiz's questions belong to one
-- assignment, same lifecycle as the assignment itself (CBC classrooms
-- reuse content by re-creating the assignment for the next class/term, the
-- same way they already do for a plain assignment).

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS is_quiz boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS assignment_questions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id  uuid        NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  question_text  text        NOT NULL,
  choices        text[]      NOT NULL,
  correct_index  int         NOT NULL,
  order_index    int         NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignment_questions_assignment_id ON assignment_questions (assignment_id, order_index);

ALTER TABLE assignment_submissions
  ADD COLUMN IF NOT EXISTS answers jsonb;

ALTER TABLE assignment_questions ENABLE ROW LEVEL SECURITY;

-- Teacher-only RLS — deliberately no student/parent SELECT policy at all.
-- correct_index must never be readable by a student's own session before
-- they submit; rather than trying to hide one column with RLS (which is
-- row-level, not column-level), the student-facing question list is served
-- exclusively through app/api/student/assignments/[id]/questions/route.ts
-- on the service-role client, which selects out correct_index explicitly —
-- same "no client policy, server route strips the sensitive field" posture
-- already used for the private Storage buckets in this initiative.
CREATE POLICY "assignment_questions: teacher crud"
  ON assignment_questions FOR ALL
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
