-- 20260619_compass_perf_indexes.sql
--
-- Targeted indexes for Learning Compass /api/learn latency.
-- Diagnosis (2026-06-19) found 6 missing indexes causing sequential scans
-- on every Compass request.
--
-- Rollback:
--   DROP INDEX IF EXISTS idx_sow_learning_areas_grade_id;
--   DROP INDEX IF EXISTS idx_sow_strands_learning_area_id;
--   DROP INDEX IF EXISTS idx_sow_substrands_strand_id;
--   DROP INDEX IF EXISTS idx_student_learning_context_student_id;
--   DROP INDEX IF EXISTS idx_compass_sessions_learner_created;
--   DROP INDEX IF EXISTS idx_compass_sessions_learner_subject_status;

BEGIN;

-- ── getGradeTopics() 4-hop RAG chain ─────────────────────────────────────────
-- Each hop filters on a FK column with no index — full sequential scans.

CREATE INDEX IF NOT EXISTS idx_sow_learning_areas_grade_id
  ON sow_learning_areas(grade_id);

CREATE INDEX IF NOT EXISTS idx_sow_strands_learning_area_id
  ON sow_strands(learning_area_id);

CREATE INDEX IF NOT EXISTS idx_sow_substrands_strand_id
  ON sow_substrands(strand_id);

-- ── student_learning_context lookup ──────────────────────────────────────────
-- Queried on every request; no index found on student_id.

CREATE INDEX IF NOT EXISTS idx_student_learning_context_student_id
  ON student_learning_context(student_id);

-- ── Last session summary query ────────────────────────────────────────────────
-- SELECT … ORDER BY created_at DESC LIMIT 1 WHERE learner_id = ?
-- Single-column learner_id index exists but Postgres must sort after filtering;
-- composite covering (learner_id, created_at DESC) lets it skip the sort.

CREATE INDEX IF NOT EXISTS idx_compass_sessions_learner_created
  ON compass_sessions(learner_id, created_at DESC);

-- ── getOrCreateSession() multi-filter ────────────────────────────────────────
-- Filters on learner_id + subject + status + date ranges.
-- (learner_id, subject, status) composite lets Postgres narrow to a handful
-- of rows before applying the timestamp filters.

CREATE INDEX IF NOT EXISTS idx_compass_sessions_learner_subject_status
  ON compass_sessions(learner_id, subject, status);

COMMIT;
