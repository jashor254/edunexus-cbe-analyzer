-- Discovered by H1D-2 DEEP smoke (teacherLifecycle.test.ts) via PostgREST's
-- schema cache. Live in production as NOT NULL with no default
-- (values observed: 'cbc_junior', 'cbc_senior'); adding nullable first so
-- any rows already inserted earlier in a bootstrap run aren't broken, then
-- backfilling and enforcing NOT NULL to match production exactly.

ALTER TABLE schemes_of_work ADD COLUMN IF NOT EXISTS curriculum_mode text;
UPDATE schemes_of_work SET curriculum_mode = 'cbc_junior' WHERE curriculum_mode IS NULL;
ALTER TABLE schemes_of_work ALTER COLUMN curriculum_mode SET NOT NULL;

-- The original recovery (00-baseline/03-sow-curriculum-tables.sql or
-- similar) used `grade_name` where production actually has `grade`, and
-- was missing total_lessons/total_weeks/average_confidence/textbook/breaks
-- entirely. It also added a `curriculum_type` column production does not
-- have at all -- and NOT NULL with no default, which blocks every real
-- INSERT (confirmed empirically: PostgREST rejected a real fixture insert
-- that correctly omitted it). Dropped rather than left in place.
ALTER TABLE schemes_of_work RENAME COLUMN grade_name TO grade;
ALTER TABLE schemes_of_work DROP COLUMN IF EXISTS curriculum_type;
ALTER TABLE schemes_of_work
  ADD COLUMN IF NOT EXISTS total_lessons integer,
  ADD COLUMN IF NOT EXISTS total_weeks integer,
  ADD COLUMN IF NOT EXISTS average_confidence double precision,
  ADD COLUMN IF NOT EXISTS textbook text,
  ADD COLUMN IF NOT EXISTS breaks jsonb;
