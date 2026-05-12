-- ============================================================
-- BETA / PIONEER MIGRATION
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Beta stats key-value counter table
CREATE TABLE IF NOT EXISTS beta_stats (
  key        TEXT        PRIMARY KEY,
  value      INTEGER     NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the teacher_signups counter (0 = no pioneers yet)
INSERT INTO beta_stats (key, value)
VALUES ('teacher_signups', 0)
ON CONFLICT (key) DO NOTHING;

-- 2. Pioneer number on the teachers table
ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS pioneer_number INTEGER;

-- 3. Atomic increment — returns the new value, which becomes the pioneer number
CREATE OR REPLACE FUNCTION increment_beta_teacher_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_val INTEGER;
BEGIN
  UPDATE beta_stats
  SET    value      = value + 1,
         updated_at = NOW()
  WHERE  key = 'teacher_signups'
  RETURNING value INTO new_val;

  RETURN new_val;
END;
$$;

-- 4. RLS: beta_stats is read-only via the public anon key
ALTER TABLE beta_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "beta_stats_public_read"
  ON beta_stats FOR SELECT
  USING (true);
