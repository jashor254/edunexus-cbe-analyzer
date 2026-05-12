-- ============================================================
-- KICD Curriculum Data Migration
-- Run this in the Supabase Dashboard → SQL Editor
-- ============================================================

-- sow_strands: per-strand KICD sub-strand data
-- Stores array of sub-strand objects from the KICD curriculum design
-- Shape: [{ title, suggested_lessons, learning_outcomes[], learning_experiences[], key_inquiry_questions[] }]
ALTER TABLE sow_strands
  ADD COLUMN IF NOT EXISTS kicd_data jsonb DEFAULT '[]';

-- sow_learning_areas: full subject-level KICD curriculum design
-- Shape: { assessment_methods[], learning_resources[], non_formal_activities[], strands: [{ strand_title, sub_strands[] }] }
ALTER TABLE sow_learning_areas
  ADD COLUMN IF NOT EXISTS kicd_subject_data jsonb DEFAULT '{}';

-- Indexes for faster JSON lookups during SOW generation
CREATE INDEX IF NOT EXISTS idx_sow_strands_kicd_data
  ON sow_strands USING gin(kicd_data);

CREATE INDEX IF NOT EXISTS idx_sow_learning_areas_kicd
  ON sow_learning_areas USING gin(kicd_subject_data);
