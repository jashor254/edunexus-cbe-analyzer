-- TIE Phase 1b: weekly_intelligence table + generation_jobs.job_type
-- Run via: supabase db push --linked

CREATE TABLE IF NOT EXISTS weekly_intelligence (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sow_id                uuid NOT NULL REFERENCES schemes_of_work(id) ON DELETE CASCADE,
  teacher_id            uuid NOT NULL,
  week_number           int NOT NULL,
  week_health_score     int,
  lessons_analyzed      int NOT NULL DEFAULT 0,
  new_flags             jsonb NOT NULL DEFAULT '[]',
  persistent_flags      jsonb NOT NULL DEFAULT '[]',
  resolved_flags        jsonb NOT NULL DEFAULT '[]',
  remedial_bank_items   jsonb NOT NULL DEFAULT '[]',
  teacher_note          text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sow_id, week_number)
);

CREATE INDEX IF NOT EXISTS idx_weekly_intelligence_sow_id     ON weekly_intelligence (sow_id);
CREATE INDEX IF NOT EXISTS idx_weekly_intelligence_teacher_id ON weekly_intelligence (teacher_id);

ALTER TABLE weekly_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_read_own_weekly_intelligence"
  ON weekly_intelligence FOR SELECT
  USING (teacher_id = auth.uid());

ALTER TABLE generation_jobs
  ADD COLUMN IF NOT EXISTS job_type TEXT
    CHECK (job_type IN ('weekly_lp', 'reflection_analysis', 'gap_root_cause', 'weekly_intelligence'));
