-- ============================================================
-- Assignment → Lesson Plan Link Migration
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS lesson_plan_id UUID REFERENCES lesson_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assignments_lesson_plan_id ON assignments(lesson_plan_id);
