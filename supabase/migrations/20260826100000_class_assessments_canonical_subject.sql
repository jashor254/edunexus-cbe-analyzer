-- Phase 3A — Core institutional assessment canonical subject identity
--
-- THE GAP THIS CLOSES
-- Every producer of `class_assessments` today stores subject identity as
-- free text in `class_assessments.subjects` (text[]) — including the Core/
-- bridged path (`app/api/core/assessments` -> lib/core/academicBridge.ts::
-- createBridgedAssessment), which already resolves a real, verified Core
-- teacher + class via `ensureBridgedClass` but never asks which
-- `class_subjects` teaching assignment the assessment belongs to. There is
-- no FK anywhere from an assessment back to `subjects`/`class_subjects`, so
-- "Core Mathematics" and "Essential Mathematics" can only ever be told
-- apart by exact string spelling at ingestion, forever.
--
-- THE MODEL
-- class_subjects  -> what the teacher is currently authorized to teach
-- subjects        -> canonical curriculum subject identity
-- class_assessments -> gets two new, additive, nullable columns:
--   class_subject_id -> the teaching assignment this assessment was
--                        created under (audit/history trail — Phase 3A
--                        Step 23 requires a departed teacher's historical
--                        assessments to keep pointing at THEIR assignment
--                        row, never a replacement's).
--   subject_id        -> canonical subject identity, snapshotted at
--                        creation time. Kept separate from
--                        `class_subject_id` deliberately: `class_subjects`
--                        rows cascade-delete if their owning `class_id`/
--                        `school_id` is ever deleted, and losing the audit
--                        link must never also silently erase which subject
--                        an assessment was actually about.
--
-- FK DELETE SEMANTICS (Phase 3A Step 5)
--   class_subject_id -> class_subjects(id) ON DELETE SET NULL
--     class_subjects.class_id/school_id are ON DELETE CASCADE (core_foundation
--     migration) — a deleted class/school cascades into deleting its
--     class_subjects rows. That must not take a historical assessment's
--     canonical subject identity down with it, so the assessment survives
--     with the audit link cleared rather than the row (or its subject_id)
--     disappearing.
--   subject_id -> subjects(id), no ON DELETE clause (default RESTRICT),
--     matching class_subjects.subject_id's own existing FK. `subjects` is
--     reference/catalogue data with no delete pathway in this codebase;
--     RESTRICT means a subject can never be deleted out from under an
--     assessment that already cites it as canonical truth, matching the
--     "durable canonical identity" requirement rather than SET NULL, which
--     would silently destroy it.
--
-- WHAT THIS MIGRATION DELIBERATELY DOES NOT DO
--   - Does not touch the legacy `subjects text[]` column — it remains the
--     display/compatibility snapshot every existing reader already expects.
--   - Does not backfill class_subject_id/subject_id for any historical row
--     (Phase 3 Step 31/36 — no guessing from subject-name text).
--   - Does not touch `learner_marks`, `learner_evidence`, or any other
--     table — Evidence identity still flows through the existing
--     `mapSubject()` writer path; this migration only gives new
--     institutional assessments a canonical identity to hand it.
--   - Does not migrate the legacy gradebook, topical-check, or report-card
--     producers (Phase 3A Step 29 — deferred, out of scope).

ALTER TABLE class_assessments
  ADD COLUMN IF NOT EXISTS class_subject_id uuid REFERENCES class_subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES subjects(id);

COMMENT ON COLUMN class_assessments.class_subject_id IS
  'The class_subjects teaching-assignment tenure this assessment was created under (audit/history trail). NULL for legacy/free-text assessments and for rows whose assignment was later deleted via cascade — never repointed to a different tenure. Not authority for reads; subject_id is the durable canonical identity.';
COMMENT ON COLUMN class_assessments.subject_id IS
  'Canonical curriculum subject identity (subjects.id), snapshotted server-side from class_subjects.subject_id at creation time — never client-supplied. NULL for legacy/free-text assessments (Phase 3 Step 22/24: never inferred after the fact). The `subjects` text[] column remains a display/compatibility snapshot, not authority, once this is set.';

CREATE INDEX IF NOT EXISTS idx_class_assessments_class_subject_id ON class_assessments (class_subject_id);
CREATE INDEX IF NOT EXISTS idx_class_assessments_subject_id ON class_assessments (subject_id);
