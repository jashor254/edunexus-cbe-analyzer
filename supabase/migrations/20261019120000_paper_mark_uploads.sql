-- Mark Papers — mark first, file after (docs/engineering/mark-papers-flow-plan.md, Step 1).
--
-- Until now Paper Intelligence wrote each learner's total into the gradebook
-- the moment the teacher reviewed their last question. Founder decision
-- 2026-10-19: the teacher marks the whole paper, and only once satisfied
-- uploads the marks — as a topical assignment (assignment score / gradebook)
-- or into a termly assessment (Opener, CAT, Mid-Term, End-Term, Exam, KJSEA
-- SBA → learner_marks → report cards).
--
-- paper_mark_uploads records where a paper's marks were filed. One row per
-- paper (UNIQUE assignment_id): a paper is filed to exactly one destination,
-- so its marks can never land in both the gradebook and a report card. A
-- re-upload after a correction updates this row and keeps its destination.
--
-- assignments.origin distinguishes a paper quick-created from Mark Papers
-- ('paper_marking', always created status = 'draft' so learners never see
-- it) from every assignment that exists today ('standard').
--
-- assignment_submission_pages.capture_source records how a page arrived —
-- phone photo or a scanned PDF — so the two can be tuned (blur threshold)
-- and their use measured.
--
-- Additive only. Existing rows: origin = 'standard', capture_source = 'phone'
-- (true of every page captured so far). Backfill at the end.

CREATE TABLE IF NOT EXISTS paper_mark_uploads (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id       uuid        NOT NULL UNIQUE REFERENCES assignments(id) ON DELETE CASCADE,
  destination         text        NOT NULL CHECK (destination IN ('topical', 'termly')),
  class_assessment_id uuid        REFERENCES class_assessments(id) ON DELETE SET NULL,
  -- The learner_marks.subject_scores key the paper's marks were written under.
  subject             text,
  uploaded_by         uuid        NOT NULL REFERENCES teachers(id),
  uploaded_at         timestamptz NOT NULL DEFAULT now(),
  learner_count       int         NOT NULL DEFAULT 0 CHECK (learner_count >= 0),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  -- A termly upload always names its subject. Its assessment may later be
  -- deleted (ON DELETE SET NULL keeps the filing record), so only the subject
  -- is enforced here; the upload service requires both at write time.
  CHECK (destination = 'topical' OR subject IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_paper_mark_uploads_class_assessment_id
  ON paper_mark_uploads (class_assessment_id);
CREATE INDEX IF NOT EXISTS idx_paper_mark_uploads_uploaded_by
  ON paper_mark_uploads (uploaded_by);

ALTER TABLE paper_mark_uploads ENABLE ROW LEVEL SECURITY;

-- Teacher-only, scoped through the assignment owner — same shape as the other
-- Paper Intelligence tables. Writes go through the service-role client in
-- lib/paperIntelligence/upload.ts after the route has authorized.
CREATE POLICY "paper_mark_uploads: teacher read"
  ON paper_mark_uploads FOR SELECT
  USING (
    assignment_id IN (
      SELECT id FROM assignments
      WHERE teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
    )
  );

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'standard'
    CHECK (origin IN ('standard', 'paper_marking'));

ALTER TABLE assignment_submission_pages
  ADD COLUMN IF NOT EXISTS capture_source text NOT NULL DEFAULT 'phone'
    CHECK (capture_source IN ('phone', 'scan'));

-- ── Backfill ────────────────────────────────────────────────────────────────
-- Every paper whose reviewed Paper Intelligence totals were already written to
-- the gradebook under the old behaviour is recorded as filed 'topical', so
-- pilot teachers' finished work is neither lost nor uploaded a second time.
INSERT INTO paper_mark_uploads (assignment_id, destination, uploaded_by, uploaded_at, learner_count)
SELECT a.id, 'topical', a.teacher_id, max(s.marked_at), count(DISTINCT s.id)
FROM assignments a
JOIN assignment_submissions s ON s.assignment_id = a.id
WHERE s.status = 'marked'
  AND s.score IS NOT NULL
  AND s.marked_at IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM paper_intelligence_script_marks m
    WHERE m.submission_id = s.id AND m.status <> 'proposed'
  )
GROUP BY a.id, a.teacher_id
ON CONFLICT (assignment_id) DO NOTHING;
