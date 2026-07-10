-- The previous migration's `source TEXT NOT NULL DEFAULT 'topical_check'`
-- retroactively backfilled ALL pre-existing strand_assessments rows (358 rows,
-- legacy data tied to a real assessment_id, predating this feature) with
-- 'topical_check', which is wrong — those came from the old
-- assessment-linked pathway, not a topical check. Correct them.

UPDATE strand_assessments
SET source = 'term_assessment'
WHERE assessment_id IS NOT NULL
  AND class_id IS NULL;
