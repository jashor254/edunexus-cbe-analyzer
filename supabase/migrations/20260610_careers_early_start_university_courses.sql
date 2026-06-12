-- Add early_start (JSONB) and university_courses (text[]) to careers table
ALTER TABLE careers
  ADD COLUMN IF NOT EXISTS early_start        jsonb,
  ADD COLUMN IF NOT EXISTS university_courses text[];
