-- Discovered by H1D-3C D1 expansion (lib/row/recordOfWorkIntegrity.integration.test.ts)
-- via PostgREST's schema cache. Live in production, absent from every
-- tracked migration / loose file that creates lesson_plans locally.

ALTER TABLE lesson_plans ADD COLUMN IF NOT EXISTS teacher_self_evaluation text;
