-- 20260803160000_fix_students_pathway_constraint.sql
--
-- Learner Pathway Contract Fix — students.current_pathway's CHECK constraint
-- allowed 'Arts & Sports' (no "Science" suffix), while every application-layer
-- validator (app/api/students/create, app/api/teacher/classes/[classId]/students,
-- lib/career/careerEngine.ts's VALID_PATHWAYS) and the sibling `careers.pathway`
-- CHECK constraint already use 'Arts & Sports Science' — confirmed as the
-- canonical KICD senior-school pathway name via docs/reference-school/
-- 02-academic-structure.md and 12 real `careers` rows already using it.
-- A prior attempt to fix this (`supabase/20260603_senior_pathway_subjects.sql`)
-- was written outside `supabase/migrations/` and was never actually applied —
-- this migration supersedes it, living in the correct location.
--
-- Confirmed via live query before writing this migration: zero `students` rows
-- use either 'Arts & Sports' or 'Arts & Sports Science' today, so there is no
-- legacy data to reconcile — the UPDATE below is a defensive no-op guard, not
-- a real data migration, kept in case that changes between authoring and apply.

BEGIN;

-- 1. Normalize any legacy short-form value before tightening the constraint
--    (a no-op today — zero rows match — kept for safety/idempotency).
UPDATE students
  SET current_pathway = 'Arts & Sports Science'
  WHERE current_pathway = 'Arts & Sports';

-- 2. Drop the outdated constraint.
ALTER TABLE students
  DROP CONSTRAINT IF EXISTS students_current_pathway_check;

-- 3. Re-add it with the canonical value, matching careers_pathway_check and
--    every application-layer validator (lib/curriculum/subjects.ts's
--    SENIOR_PATHWAYS is the single source of truth for these three values).
ALTER TABLE students
  ADD CONSTRAINT students_current_pathway_check
  CHECK (current_pathway IN ('STEM', 'Social Sciences', 'Arts & Sports Science'));

COMMIT;
