-- Paper Intelligence Prototype 01 — Gate 2 (open-response rubric readiness).
--
-- assignment_questions is exclusively MCQ (choices text[] + correct_index
-- int) — confirmed exhaustively by the pre-build forensic audit, no rubric
-- or expected-answer concept exists anywhere in the schema. This table is
-- the smallest additive primitive to close that gap, WITHOUT touching
-- assignment_questions/assignment_question_variants at all (both are
-- explicitly off-limits for this prototype).
--
-- Deliberately keyed on (assignment_id, question_number) rather than a FK
-- into assignment_questions: an open-response question is not a variant of
-- an MCQ row, it's a parallel concept scoped to the same assignment.
-- question_number is a 1-based ordinal the teacher/prototype fixture
-- assigns (e.g. "question 3 of this assignment"), not a foreign key.
--
-- Teacher-authored only — the AI marks against this rubric, it never
-- creates or edits one (Prototype 01 spec, Gate 2: "The AI may interpret
-- the learner answer against the supplied rubric. It may NOT redefine the
-- rubric.").

CREATE TABLE IF NOT EXISTS open_response_rubrics (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id            uuid        NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  question_number          int         NOT NULL CHECK (question_number > 0),
  -- Display-only curriculum reference, same discipline as
  -- assignment_question_variants.sub_strand_id — copied at creation time,
  -- never re-resolved. Nullable: honest when the question has no specific
  -- sub-strand anchor.
  sub_strand_id            uuid        REFERENCES sow_substrands(id),
  question_text            text        NOT NULL,
  expected_answer_summary  text        NOT NULL,
  -- Structured, not one opaque text blob — e.g.
  -- [{"criterion": "identifies an effect", "points": 1},
  --  {"criterion": "explains the effect", "points": 1}]
  marking_criteria         jsonb       NOT NULL DEFAULT '[]',
  max_marks                int         NOT NULL CHECK (max_marks > 0),
  created_by               uuid        NOT NULL REFERENCES teachers(id),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, question_number)
);

CREATE INDEX IF NOT EXISTS idx_open_response_rubrics_assignment_id
  ON open_response_rubrics (assignment_id);

ALTER TABLE open_response_rubrics ENABLE ROW LEVEL SECURITY;

-- Teacher-only RLS, identical shape to assignment_question_variants' own
-- policy — no student/parent SELECT policy. A rubric's expected answer
-- must never be readable by a student's own session before they submit.
CREATE POLICY "open_response_rubrics: teacher crud"
  ON open_response_rubrics FOR ALL
  USING (
    assignment_id IN (
      SELECT id FROM assignments WHERE teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    assignment_id IN (
      SELECT id FROM assignments WHERE teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
    )
  );
