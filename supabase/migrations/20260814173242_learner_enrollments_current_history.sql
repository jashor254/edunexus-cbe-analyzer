-- Learner enrollment history — Phase 4 ("The Term Turns and the Learner Moves").
--
-- THE GAP THIS CLOSES
-- `learner_enrollments` carried a total UNIQUE(learner_id, term_id) and was
-- written with an upsert on that key, so moving a learner to a different
-- class WITHIN THE SAME TERM overwrote class_id in place:
--
--     Jane enrolled in 7A
--     Jane moves to 7B
--     -> class_id updated in place on the SAME row
--     -> no row anywhere records that Jane was ever in 7A that term
--
-- A school owns the class roster; a learner occupies a time-bounded seat in
-- it. Movement must not erase the placement that came before it — the exact
-- invariant class_subjects (20260813120000) already enforces for teaching
-- assignments. This migration gives learner_enrollments the same shape.
--
-- THE MODEL
-- History lives in learner_enrollments itself, not a side table:
--
--   ended_at   NULL = this row is the learner's CURRENT placement for this
--              term. Non-null = superseded by a later placement (a class
--              move), closed at that instant.
--
-- Deliberately independent of the existing `status` column. `status`
-- ('active'|'withdrawn'|'transferred') already means "how did this specific
-- placement end, if it did" and is untouched by this migration — a
-- withdrawn/transferred row is excluded from the CURRENT roster by `status`,
-- exactly as it already was (getClassRoster/findClassRoster filter
-- status='active', unchanged). `ended_at` answers a different question —
-- "was this placement superseded by a move" — which `status` had no way to
-- express. A row can be non-current for either reason independently; a
-- learner's true current placement for a term is
-- `status = 'active' AND ended_at IS NULL`.
--
-- THE INVARIANT
-- At most one CURRENT (status='active' AND ended_at IS NULL) enrollment per
-- (learner_id, term_id), enforced by a partial unique index rather than
-- application logic — same mechanism class_subjects_current_assignment_uniq
-- already uses. Many historical rows may now share (learner_id, term_id).
--
-- SAFETY / LIVE-DATA PROOF
-- Additive: no row is deleted, no learner_id/class_id/term_id is
-- transformed. `ended_at` is added nullable with no backfill needed — every
-- existing row already reads ended_at IS NULL (the column is new), which is
-- the correct value: no learner has ever been "moved" yet, so no row should
-- be historical. Live check before writing this migration (read-only,
-- via mcp__supabase__execute_sql): 709 total rows, 682 active / 26 withdrawn
-- / 1 transferred, ZERO duplicates by (learner_id, term_id) — the OLD total
-- unique constraint made that structurally impossible, so the NEW partial
-- constraint (a strict subset of that guarantee: it only counts active,
-- open rows) is trivially satisfied by every existing row without any
-- reconciliation. No PHASE 4 BLOCKED condition applies.
--
-- RIPPLE EFFECT — ON CONFLICT callers
-- repos.learners.upsertEnrollment()/upsertEnrollments() used
-- `.upsert(..., { onConflict: 'learner_id,term_id' })`, which requires a
-- NON-partial unique constraint/index on exactly those columns for Postgres
-- to infer the conflict target. Dropping the total constraint breaks that
-- inference. Both functions are rewritten in the same commit as this
-- migration (lib/repositories/learner.repository.ts) to an explicit
-- find-current/close/insert sequence instead of a native upsert — which,
-- as a direct and desirable consequence, ALSO stops CSV re-import and
-- re-onboarding from silently overwriting a learner's prior placement, the
-- same class of bug this migration exists to fix for the new move
-- operation. Every existing caller (onboardLearner, learnerRoster import,
-- previewPromotion/runAnnualPromotion's use of enrollLearner) keeps its
-- exact external contract: same return shape, still idempotent, still safe
-- to call repeatedly for the SAME class (true no-op, no new row written).
--
-- ROLLBACK (reasoning, not a script to run blindly): only safe while no
-- learner has more than one row per (learner_id, term_id) — i.e. before any
-- move has been recorded:
--   DROP INDEX learner_enrollments_current_uniq;
--   ALTER TABLE learner_enrollments ADD CONSTRAINT learner_enrollments_learner_id_term_id_key UNIQUE (learner_id, term_id);
--   ALTER TABLE learner_enrollments DROP COLUMN ended_at;
-- Once real move history exists, rolling back means choosing which
-- placement to destroy, so it is a forward-only decision from the first
-- move onward — exactly class_subjects_assignment_history's own rollback note.

BEGIN;

-- ── 1. Column ────────────────────────────────────────────────────────────

ALTER TABLE learner_enrollments
  ADD COLUMN IF NOT EXISTS ended_at timestamptz;

COMMENT ON COLUMN learner_enrollments.ended_at IS
  'NULL = this row is the learner''s CURRENT class placement for this term. Non-null = superseded by a later placement (a mid-term class move), closed at this instant. Independent of `status`: a withdrawn/transferred row is excluded from "current" by status, not by this column. Never delete a closed row; it is the record that this learner was previously in this class.';

-- ── 2. The current-enrollment invariant ─────────────────────────────────

-- The old constraint permitted exactly one row per (learner_id, term_id),
-- which is what forced a class move to overwrite. Dropped and replaced with
-- the same guarantee scoped to CURRENT (active, open) rows only.
ALTER TABLE learner_enrollments
  DROP CONSTRAINT IF EXISTS learner_enrollments_learner_id_term_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS learner_enrollments_current_uniq
  ON learner_enrollments (learner_id, term_id)
  WHERE status = 'active' AND ended_at IS NULL;

-- Every roster read ("who is currently in 7A this term") filters
-- class_id + term_id + status='active'; this keeps that path index-backed
-- as historical rows accumulate. Matches findClassRoster's actual filter.
CREATE INDEX IF NOT EXISTS idx_learner_enrollments_class_current
  ON learner_enrollments (class_id, term_id)
  WHERE status = 'active' AND ended_at IS NULL;

-- Historical lookups for one learner ("which classes has Jane been placed
-- in this term / across terms?").
CREATE INDEX IF NOT EXISTS idx_learner_enrollments_learner_history
  ON learner_enrollments (learner_id, term_id, enrollment_date DESC);

COMMIT;
