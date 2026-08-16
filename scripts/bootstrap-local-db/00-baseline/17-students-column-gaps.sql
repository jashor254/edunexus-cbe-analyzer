-- Discovered by H1D-2 DEEP smoke (schoolUsersRlsRegression.integration.test.ts)
-- via PostgREST's schema cache (PGRST204), not by direct superuser SQL --
-- these columns are live in production but absent from every tracked
-- migration / loose file that creates `students` locally.

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS curriculum_type text NOT NULL DEFAULT 'cbc',
  ADD COLUMN IF NOT EXISTS year_level text,
  ADD COLUMN IF NOT EXISTS added_by text NOT NULL DEFAULT 'parent',
  ADD COLUMN IF NOT EXISTS selected_subjects text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_beta_tester boolean NOT NULL DEFAULT false;

-- final_schema.sql's students.user_id is NOT NULL; production allows NULL
-- (teacher-added students with no linked auth account -- confirmed via
-- information_schema.columns.is_nullable = 'YES' 2026-08-16). An
-- unrecovered later ALTER relaxed this in production; no tracked migration
-- captures it.
ALTER TABLE students ALTER COLUMN user_id DROP NOT NULL;

-- Same class of drift: class_students.parent_id is NOT NULL locally,
-- nullable in production (confirmed via information_schema 2026-08-16).
ALTER TABLE class_students ALTER COLUMN parent_id DROP NOT NULL;
