-- Paper Intelligence Phase 1 — Commit 4a (schema).
--
-- One row per (learner submission, rubric question): what the AI read on the
-- learner's script and what it proposed, kept as Paper Intelligence's own
-- feature-local record. Founder decision 2026-10-14: review-by-question
-- (Commit 5) and accept-answer re-apply (Commit 6) read THIS table, never
-- learner_evidence — so the Decision-5 evidence read-path guard is never
-- touched by a feature module (docs/architecture/learner-record-layer-
-- decisions.md). learner_evidence stays the canonical record of the outcome;
-- each row here links to the pending_review evidence it produced.
--
-- `points` holds the per-point classification the marking turns on (Phase 0):
--   [{"text": "Courage", "classification": "plausible_not_in_scheme",
--     "awarded": 0, "matchedAnswer": null, "note": "real trait, not listed"}]
-- proposed_mark awards scheme matches only; plausible_mark is the score if
-- every plausible_not_in_scheme point were accepted — the "4/5 (5 if you
-- accept Courage)" the teacher sees at review.
--
-- A re-mark (e.g. a retaken page) replaces a submission's rows; the prior
-- pending evidence is rejected through evidenceLifecycle.rejectReview, never
-- edited. final_mark / reviewed_by / reviewed_at are written at teacher review
-- (Commit 5) — added now so this table lands in one migration.

CREATE TABLE IF NOT EXISTS paper_intelligence_script_marks (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id          uuid        NOT NULL REFERENCES assignment_submissions(id) ON DELETE CASCADE,
  assignment_id          uuid        NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  rubric_id              uuid        NOT NULL REFERENCES open_response_rubrics(id) ON DELETE CASCADE,
  -- The pending_review evidence row this proposal produced; null if the
  -- evidence write failed (logged in paper_intelligence_failure_log).
  evidence_id            uuid        REFERENCES learner_evidence(id) ON DELETE SET NULL,
  recognized_answer      text        NOT NULL DEFAULT '',
  points                 jsonb       NOT NULL DEFAULT '[]'::jsonb,
  proposed_mark          int         NOT NULL CHECK (proposed_mark >= 0),
  plausible_mark         int         NOT NULL CHECK (plausible_mark >= 0),
  max_mark               int         NOT NULL CHECK (max_mark > 0),
  recognition_confidence numeric     CHECK (recognition_confidence IS NULL OR recognition_confidence BETWEEN 0 AND 1),
  grading_confidence     numeric     CHECK (grading_confidence IS NULL OR grading_confidence BETWEEN 0 AND 1),
  uncertain              boolean     NOT NULL DEFAULT false,
  rationale              text,
  -- Which captured pages the answer was read from (answers span pages).
  page_numbers           int[]       NOT NULL DEFAULT '{}',
  status                 text        NOT NULL DEFAULT 'proposed'
                                     CHECK (status IN ('proposed', 'confirmed', 'overridden')),
  final_mark             int         CHECK (final_mark IS NULL OR final_mark >= 0),
  -- teachers.id, matching open_response_rubrics.created_by's identity space.
  reviewed_by            uuid        REFERENCES teachers(id),
  reviewed_at            timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_id, rubric_id),
  CHECK (proposed_mark <= max_mark AND plausible_mark <= max_mark AND plausible_mark >= proposed_mark),
  CHECK (final_mark IS NULL OR final_mark <= max_mark)
);

CREATE INDEX IF NOT EXISTS idx_pi_script_marks_submission_id
  ON paper_intelligence_script_marks (submission_id);
-- Review-by-question reads every learner's answer to one question at once.
CREATE INDEX IF NOT EXISTS idx_pi_script_marks_assignment_rubric
  ON paper_intelligence_script_marks (assignment_id, rubric_id);
CREATE INDEX IF NOT EXISTS idx_pi_script_marks_rubric_id
  ON paper_intelligence_script_marks (rubric_id);
CREATE INDEX IF NOT EXISTS idx_pi_script_marks_evidence_id
  ON paper_intelligence_script_marks (evidence_id);
CREATE INDEX IF NOT EXISTS idx_pi_script_marks_reviewed_by
  ON paper_intelligence_script_marks (reviewed_by);

ALTER TABLE paper_intelligence_script_marks ENABLE ROW LEVEL SECURITY;

-- Teacher-only, scoped through the assignment owner — same shape as the
-- other Phase 1 tables. Reads/writes in practice go through the service-role
-- client in routes that run requireClassTeacher() first.
CREATE POLICY "paper_intelligence_script_marks: teacher crud"
  ON paper_intelligence_script_marks FOR ALL
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
