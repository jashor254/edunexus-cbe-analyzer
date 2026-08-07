-- 20260807120000_record_of_work_integrity.sql
--
-- Phase 1 — Record of Work Integrity.
-- See docs/architecture/adr-0032-teaching-document-identity-contract.md
--
-- ── Why this migration exists ───────────────────────────────────────────────
--
-- The Record of Work tables were created by hand from supabase/records_of_work
-- _migration.sql ("Run this in your Supabase SQL editor"), NOT by anything in
-- supabase/migrations/. The later 20260530_sow_tables.sql was written to
-- describe them after the fact and wrapped everything in CREATE TABLE IF NOT
-- EXISTS — so against tables that already existed it applied nothing, and its
-- declared constraints never took effect. The observable results in
-- production were:
--
--   * records_of_work.teacher_id had NO foreign key, despite the migration
--     file claiming REFERENCES teachers(id). The column therefore accepted
--     ids from either namespace, and did.
--   * row_entries gained six columns and records_of_work gained
--     UNIQUE (scheme_id) via manual SQL that exists in no file in this
--     repository. The Monday cron depends on both.
--
-- This migration is forward-only and idempotent. It does NOT recreate any
-- table, does NOT drop any teacher data, and is safe to apply both to
-- production (where most of this already exists) and to a database built
-- from scratch out of supabase/migrations/ (where none of it does).
--
-- It FAILS CLOSED: if the ownership data cannot be remediated unambiguously,
-- the transaction aborts rather than coercing a guess into a foreign key.
--
-- Rollback: see the bottom of this file.

BEGIN;

-- ============================================================
-- 1. row_entries — capture the six live-only columns
-- ============================================================
-- Written by the Monday cron, read by /teacher/record-of-work/[id] and
-- /teacher/booklet. Present in production, absent from every migration.

ALTER TABLE row_entries ADD COLUMN IF NOT EXISTS learning_outcomes     JSONB DEFAULT '[]'::jsonb;
ALTER TABLE row_entries ADD COLUMN IF NOT EXISTS key_inquiry_questions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE row_entries ADD COLUMN IF NOT EXISTS learning_resources    JSONB DEFAULT '[]'::jsonb;
ALTER TABLE row_entries ADD COLUMN IF NOT EXISTS activities_summary    JSONB DEFAULT '[]'::jsonb;
ALTER TABLE row_entries ADD COLUMN IF NOT EXISTS status                TEXT  DEFAULT 'completed'::text;
ALTER TABLE row_entries ADD COLUMN IF NOT EXISTS remarks               TEXT  DEFAULT ''::text;

-- NOTE ON `status` DEFAULT: kept as 'completed' to match production exactly.
-- The application no longer writes that value — lib/row/recordOfWork.ts
-- writes 'planned', because a machine asserting that teaching *happened* is
-- precisely the confusion Phase 1 exists to remove. The column default is
-- left alone so this migration changes no existing row's meaning; nothing
-- reads the column today (ADR-0032 §8).


-- ============================================================
-- 2. Uniqueness the canonical writer relies on
-- ============================================================

-- One Record of Work per scheme. Present live (records_of_work_scheme_id_key),
-- absent from every migration file. lib/row/recordOfWork.ts's get-or-create
-- and the cron's conflict handling both depend on it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'records_of_work'::regclass AND conname = 'records_of_work_scheme_id_key'
  ) THEN
    -- Fail closed rather than silently dropping data if duplicates exist.
    IF EXISTS (
      SELECT 1 FROM records_of_work
      WHERE scheme_id IS NOT NULL GROUP BY scheme_id HAVING count(*) > 1
    ) THEN
      RAISE EXCEPTION
        'record_of_work_integrity: cannot add UNIQUE (scheme_id) — duplicate scheme_id rows exist. Resolve them manually; this migration will not choose a winner.';
    END IF;

    ALTER TABLE records_of_work ADD CONSTRAINT records_of_work_scheme_id_key UNIQUE (scheme_id);
  END IF;
END $$;

-- One entry per (record, week, lesson).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'row_entries'::regclass
      AND contype = 'u'
      AND conkey @> ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid='row_entries'::regclass AND attname='row_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid='row_entries'::regclass AND attname='week'),
        (SELECT attnum FROM pg_attribute WHERE attrelid='row_entries'::regclass AND attname='lesson')
      ]
  ) THEN
    IF EXISTS (
      SELECT 1 FROM row_entries GROUP BY row_id, week, lesson HAVING count(*) > 1
    ) THEN
      RAISE EXCEPTION
        'record_of_work_integrity: cannot add UNIQUE (row_id, week, lesson) — duplicates exist. Resolve them manually.';
    END IF;

    ALTER TABLE row_entries ADD CONSTRAINT row_entries_row_week_lesson_key UNIQUE (row_id, week, lesson);
  END IF;
END $$;


-- ============================================================
-- 3. Remediate mis-namespaced owners  (Phase 1 Step 5)
-- ============================================================
-- Production contains Record of Work headers whose teacher_id is an
-- auth.users id, written by the pre-Phase-1 cron. They are invisible to
-- their rightful teacher under both RLS and every API filter.
--
-- Mapping is deterministic: teachers.user_id -> teachers.id. No UUID is
-- hardcoded. Only rows that are PROVABLY in the auth namespace are touched.

-- 3a. Refuse to proceed if any mapping is ambiguous.
DO $$
DECLARE ambiguous INT;
BEGIN
  SELECT count(*) INTO ambiguous
  FROM (
    SELECT r.id
    FROM records_of_work r
    WHERE NOT EXISTS (SELECT 1 FROM teachers t WHERE t.id = r.teacher_id)
      AND EXISTS     (SELECT 1 FROM auth.users u WHERE u.id = r.teacher_id)
    GROUP BY r.id
    HAVING (SELECT count(*) FROM teachers t2 WHERE t2.user_id = r.teacher_id) <> 1
  ) amb;

  IF ambiguous > 0 THEN
    RAISE EXCEPTION
      'record_of_work_integrity: % Record of Work row(s) map to zero or multiple teachers. Refusing to guess an owner.', ambiguous;
  END IF;
END $$;

-- 3b. Remap. Safety conditions are in the WHERE clause, not assumed:
--     the current value must be a real auth.users id, must NOT already be a
--     teachers.id, and must resolve to exactly one teachers row.
UPDATE records_of_work r
SET    teacher_id = t.id,
       updated_at = NOW()
FROM   teachers t
WHERE  t.user_id = r.teacher_id
  AND  NOT EXISTS (SELECT 1 FROM teachers t2   WHERE t2.id = r.teacher_id)
  AND  EXISTS     (SELECT 1 FROM auth.users u  WHERE u.id  = r.teacher_id);

-- 3c. Prove the invariant holds before relying on it.
DO $$
DECLARE orphans INT;
BEGIN
  SELECT count(*) INTO orphans
  FROM records_of_work r
  WHERE r.teacher_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM teachers t WHERE t.id = r.teacher_id);

  IF orphans > 0 THEN
    RAISE EXCEPTION
      'record_of_work_integrity: % Record of Work row(s) still do not resolve to a teachers row. Not adding the foreign key.', orphans;
  END IF;
END $$;


-- ============================================================
-- 4. The foreign key that should always have existed
-- ============================================================
-- ON DELETE CASCADE matches schemes_of_work.teacher_id's existing behaviour:
-- deleting a teacher removes their teaching documents, it does not orphan
-- them into an unreadable state.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'records_of_work'::regclass AND conname = 'records_of_work_teacher_id_fkey'
  ) THEN
    ALTER TABLE records_of_work
      ADD CONSTRAINT records_of_work_teacher_id_fkey
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE;
  END IF;
END $$;


-- ============================================================
-- 4b. Normalise the scheme_id FK delete behaviour
-- ============================================================
-- Production is ON DELETE CASCADE; both SQL files in this repository declare
-- ON DELETE SET NULL. Live wins: CASCADE is also the coherent choice, since a
-- Record of Work orphaned from its scheme could never be reached again
-- (nothing lists scheme-less records) and row_entries already cascade.

DO $$
DECLARE current_def TEXT;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO current_def
  FROM pg_constraint
  WHERE conrelid = 'records_of_work'::regclass AND conname = 'records_of_work_scheme_id_fkey';

  IF current_def IS NOT NULL AND current_def NOT LIKE '%ON DELETE CASCADE%' THEN
    ALTER TABLE records_of_work DROP CONSTRAINT records_of_work_scheme_id_fkey;
    ALTER TABLE records_of_work
      ADD CONSTRAINT records_of_work_scheme_id_fkey
      FOREIGN KEY (scheme_id) REFERENCES schemes_of_work(id) ON DELETE CASCADE;
  END IF;
END $$;


-- ============================================================
-- 5. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_records_of_work_teacher_id ON records_of_work(teacher_id);
CREATE INDEX IF NOT EXISTS idx_records_of_work_scheme_id  ON records_of_work(scheme_id);
CREATE INDEX IF NOT EXISTS idx_row_entries_row_id         ON row_entries(row_id);
CREATE INDEX IF NOT EXISTS idx_row_entries_week           ON row_entries(row_id, week, lesson);


-- ============================================================
-- 6. RLS — consolidate to least privilege
-- ============================================================
-- Production accumulated policies from three sources (the loose SQL file,
-- 20260530_sow_tables.sql, and manual SQL). Postgres ORs permissive
-- policies, so the effective grant was the widest of them. Each is
-- classified below; none of these decisions widens access.

ALTER TABLE records_of_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE row_entries     ENABLE ROW LEVEL SECURITY;

-- REMOVED — exact duplicate. `teachers_select_own_row` used the predicate
-- `teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())`,
-- which is definitionally what auth_teacher_id() returns. The canonical
-- policy below already covers it, for ALL commands rather than SELECT only.
-- No teacher loses any access.
DROP POLICY IF EXISTS "teachers_select_own_row" ON records_of_work;
DROP POLICY IF EXISTS "teachers_select_own_row_entries" ON row_entries;

-- REMOVED — unnecessary and over-broad. `Admin full access on ...` granted
-- every `teachers.role = 'admin'` account unrestricted read AND write over
-- every teacher's Record of Work, with WITH CHECK null (i.e. writes
-- unconstrained). No code path needs it: every route and page that touches
-- these tables uses the service-role client, which bypasses RLS entirely
-- (verified across all 8 call sites). Removing it is a least-privilege
-- correction, not a feature change. Admin *product* surfaces are unaffected.
DROP POLICY IF EXISTS "Admin full access on records_of_work" ON records_of_work;
DROP POLICY IF EXISTS "Admin full access on row_entries"     ON row_entries;

-- PRESERVED — the canonical ownership policies. Recreated (not merely left
-- alone) so this file is the reproducible definition of them.
DROP POLICY IF EXISTS "records_of_work: own" ON records_of_work;
CREATE POLICY "records_of_work: own"
  ON records_of_work FOR ALL
  USING      (teacher_id = auth_teacher_id())
  WITH CHECK (teacher_id = auth_teacher_id());

DROP POLICY IF EXISTS "row_entries: own via row" ON row_entries;
CREATE POLICY "row_entries: own via row"
  ON row_entries FOR ALL
  USING (
    row_id IN (SELECT id FROM records_of_work WHERE teacher_id = auth_teacher_id())
  )
  WITH CHECK (
    row_id IN (SELECT id FROM records_of_work WHERE teacher_id = auth_teacher_id())
  );

-- PRESERVED — the backend's own access. Every application call path runs
-- under this role.
DROP POLICY IF EXISTS "records_of_work: service role" ON records_of_work;
CREATE POLICY "records_of_work: service role"
  ON records_of_work FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "row_entries: service role" ON row_entries;
CREATE POLICY "row_entries: service role"
  ON row_entries FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Legacy names from the loose SQL file, superseded by the two above.
DROP POLICY IF EXISTS "service_all_row"     ON records_of_work;
DROP POLICY IF EXISTS "service_all_entries" ON row_entries;

COMMIT;

-- ── Rollback ────────────────────────────────────────────────────────────────
-- The owner remediation in section 3 is NOT reversible by design: the
-- pre-migration values were unusable (invisible to their own teacher). To
-- reverse the structural parts only:
--
--   ALTER TABLE records_of_work DROP CONSTRAINT records_of_work_teacher_id_fkey;
--   ALTER TABLE records_of_work DROP CONSTRAINT records_of_work_scheme_id_key;
--   -- (the row_entries columns and unique key are load-bearing; do not drop)
