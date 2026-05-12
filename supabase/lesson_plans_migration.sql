-- ============================================================
-- Lesson Plans Migration
-- Run this in the Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS lesson_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sow_id UUID REFERENCES schemes_of_work(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES auth.users(id),
  week_number INTEGER NOT NULL,
  lesson_number INTEGER NOT NULL,
  strand TEXT NOT NULL,
  sub_strand TEXT NOT NULL,
  learning_outcomes JSONB DEFAULT '[]',
  key_inquiry_questions JSONB DEFAULT '[]',
  learning_resources JSONB DEFAULT '[]',
  organisation_of_learning TEXT,
  introduction TEXT,
  step_1 TEXT,
  step_2 TEXT,
  step_3 TEXT,
  conclusion TEXT,
  extended_activities TEXT,
  reflection TEXT,
  status TEXT DEFAULT 'generated'
    CHECK (status IN ('generated', 'edited', 'taught')),
  taught_date DATE,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS generation_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID REFERENCES auth.users(id),
  sow_id UUID,
  week_number INTEGER,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- RLS
ALTER TABLE lesson_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teacher_own_plans" ON lesson_plans;
CREATE POLICY "teacher_own_plans" ON lesson_plans
  FOR ALL USING (teacher_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lesson_plans_teacher_id ON lesson_plans(teacher_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_sow_id ON lesson_plans(sow_id);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_week ON lesson_plans(sow_id, week_number);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_teacher ON generation_jobs(teacher_id);
