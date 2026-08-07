-- 20260807160000_lesson_plans_week_lesson_unique.sql
--
-- Teaching Workflow Reliability, Phase 0 (R2) — restore the lesson-plan
-- idempotency guarantee.
--
-- ── Why this is necessary ───────────────────────────────────────────────────
--
-- `supabase/migrations/20260530_sow_tables.sql` declares
--
--     UNIQUE (sow_id, week_number, lesson_number)
--
-- inside a `CREATE TABLE IF NOT EXISTS lesson_plans (...)`. The table already
-- existed — it was created by hand from `supabase/lesson_plans_migration.sql`
-- ("Run this in the Supabase Dashboard → SQL Editor"), which declares no such
-- constraint. The CREATE was therefore a no-op and the constraint has never
-- existed in production: `lesson_plans` carries only `lesson_plans_pkey`.
--
-- The application has been assuming it. `/api/lesson-plans/generate` guards
-- against regeneration with a count-then-insert pre-check, which is racy
-- without a constraint, and the Friday cron is expected to be safe against
-- Vercel retries and double invocation. Phase 0 Audit A6 requires that
-- guarantee to be real, and it is the one place in this phase where an
-- application-only fix cannot deliver it.
--
-- This is additive and idempotent. It creates no table, drops nothing, and
-- changes no column. It FAILS CLOSED: if duplicates exist it aborts rather
-- than choosing which lesson plan to discard — teacher-generated work is
-- never deleted by a migration.
--
-- Verified before writing: production currently holds 0 duplicate
-- (sow_id, week_number, lesson_number) groups, so this applies cleanly.
--
-- Rollback:
--   ALTER TABLE lesson_plans DROP CONSTRAINT lesson_plans_sow_week_lesson_key;

BEGIN;

DO $$
DECLARE dupe_groups INT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'lesson_plans'::regclass
      AND contype = 'u'
      AND conkey @> ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid='lesson_plans'::regclass AND attname='sow_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid='lesson_plans'::regclass AND attname='week_number'),
        (SELECT attnum FROM pg_attribute WHERE attrelid='lesson_plans'::regclass AND attname='lesson_number')
      ]
  ) THEN
    RAISE NOTICE 'lesson_plans already has the (sow_id, week_number, lesson_number) unique constraint — nothing to do.';
    RETURN;
  END IF;

  SELECT count(*) INTO dupe_groups FROM (
    SELECT 1 FROM lesson_plans
    GROUP BY sow_id, week_number, lesson_number
    HAVING count(*) > 1
  ) d;

  IF dupe_groups > 0 THEN
    RAISE EXCEPTION
      'lesson_plans_week_lesson_unique: % duplicate (sow_id, week_number, lesson_number) group(s) exist. Resolve them manually — this migration will not choose which teacher-generated lesson plan to delete.', dupe_groups;
  END IF;

  ALTER TABLE lesson_plans
    ADD CONSTRAINT lesson_plans_sow_week_lesson_key
    UNIQUE (sow_id, week_number, lesson_number);
END $$;

COMMIT;
