-- Teaching assignment history.
--
-- THE GAP THIS CLOSES
-- `class_subjects` is the canonical institutional teaching assignment
-- (school_id, class_id, subject_id, teacher_id -> school_users.id). Until now
-- it carried UNIQUE(class_id, subject_id) and was written with an upsert on
-- that key, so replacing a teacher OVERWROTE the row in place:
--
--     Peter teaches Mathematics -> Grade 7 East
--     Mary replaces Peter
--     -> teacher_id updated in place
--     -> no row anywhere records that Peter ever taught it
--
-- A school owns the class and the subject; a teacher occupies a time-bounded
-- assignment. Turnover must not erase the tenure that came before it.
--
-- THE MODEL
-- History lives in `class_subjects` itself rather than a side table. The whole
-- production surface is three statements in one repository file
-- (lib/repositories/teacher.repository.ts), so filtering current-vs-historical
-- there is cheap — whereas a second table would re-split the canonical
-- assignment source that the preceding convergence phases spent their effort
-- merging into one place.
--
--   started_at  when this assignment began
--   ended_at    NULL = CURRENT. Non-null = historical, closed at that instant.
--
-- No status enum: "is it current" has exactly two states and `ended_at IS NULL`
-- expresses both the boolean and the timestamp without a second column that
-- could disagree with it.
--
-- THE INVARIANT
-- At most one CURRENT teacher per class+subject, enforced by a partial unique
-- index rather than application logic. Many historical rows may share the same
-- (class_id, subject_id). Co-teaching stays deliberately unsupported — the
-- uniqueness is not weakened for a capability no pilot school has asked for.
--
-- SAFETY
-- Additive for data: no row is deleted, no teacher_id is transformed, no class
-- or subject reference changes. All 144 existing rows are backfilled as CURRENT
-- (ended_at NULL) with started_at taken from their own created_at, not from
-- now(), so an assignment's age is preserved rather than reset by this
-- migration.
--
-- The one non-additive step is replacing the total UNIQUE constraint with the
-- partial unique index — unavoidable, since historical rows exist precisely to
-- duplicate (class_id, subject_id), which the total constraint forbids.
--
-- ROLLBACK (reasoning, not a script to run blindly): close nothing, then
--   DROP INDEX class_subjects_current_assignment_uniq;
--   ALTER TABLE class_subjects ADD CONSTRAINT class_subjects_class_id_subject_id_key UNIQUE (class_id, subject_id);
--   ALTER TABLE class_subjects DROP COLUMN ended_at, DROP COLUMN started_at;
-- This only succeeds while no class+subject has more than one row — i.e. before
-- any replacement has been recorded. Once real history exists, rolling back
-- means choosing which tenure to destroy, so it is a forward-only decision from
-- the first replacement onward.

BEGIN;

-- ── 1. Columns (nullable first, so the backfill decides the values) ─────────

ALTER TABLE class_subjects
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at   timestamptz;

-- Existing assignments began when they were created, not when this migration
-- ran. Only touches rows that have not already been given a value.
UPDATE class_subjects SET started_at = created_at WHERE started_at IS NULL;

ALTER TABLE class_subjects
  ALTER COLUMN started_at SET NOT NULL,
  ALTER COLUMN started_at SET DEFAULT now();

-- `ended_at` stays nullable and has no default: NULL is the meaningful value
-- (this assignment is current), not a placeholder for missing data.

COMMENT ON COLUMN class_subjects.started_at IS
  'When this teaching assignment began. Backfilled from created_at for rows predating assignment history.';
COMMENT ON COLUMN class_subjects.ended_at IS
  'NULL = this is the CURRENT assignment for (class_id, subject_id). Non-null = historical tenure, closed at this instant. Never delete a closed row; it is the record that this teacher taught this subject.';

-- ── 2. The current-assignment invariant ────────────────────────────────────

-- The old constraint permitted exactly one row per (class_id, subject_id),
-- which is what forced replacement to overwrite. Dropped and replaced with the
-- same guarantee scoped to CURRENT rows only.
ALTER TABLE class_subjects
  DROP CONSTRAINT IF EXISTS class_subjects_class_id_subject_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS class_subjects_current_assignment_uniq
  ON class_subjects (class_id, subject_id)
  WHERE ended_at IS NULL;

-- Every read of "what does this teacher currently teach" filters on
-- ended_at IS NULL alongside teacher_id; this keeps that path index-backed
-- as historical rows accumulate.
CREATE INDEX IF NOT EXISTS idx_class_subjects_teacher_current
  ON class_subjects (teacher_id)
  WHERE ended_at IS NULL;

-- Historical lookups for one class ("who has taught 7 East Mathematics?").
CREATE INDEX IF NOT EXISTS idx_class_subjects_class_subject_history
  ON class_subjects (class_id, subject_id, started_at DESC);

COMMIT;
