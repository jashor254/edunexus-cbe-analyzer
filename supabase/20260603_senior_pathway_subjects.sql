-- Senior school pathway + subject selection migration
-- Adds selected_subjects column and fixes Arts & Sports pathway constraint

-- 1. Drop old CHECK constraint on current_pathway (value was 'Arts & Sports', should be 'Arts & Sports Science')
ALTER TABLE students
  DROP CONSTRAINT IF EXISTS students_current_pathway_check;

-- 2. Re-add constraint with correct value
ALTER TABLE students
  ADD CONSTRAINT students_current_pathway_check
  CHECK (current_pathway IN ('STEM', 'Social Sciences', 'Arts & Sports Science'));

-- 3. Add selected_subjects column if not exists
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS selected_subjects text[] DEFAULT '{}';

-- 4. Index on current_pathway for pathway-filtered queries
CREATE INDEX IF NOT EXISTS idx_students_pathway
  ON students(current_pathway)
  WHERE current_pathway IS NOT NULL;

-- 5. Confirm
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'students'
  AND column_name IN ('current_pathway', 'selected_subjects');
