-- Phase 13.2 — Performance: missing indexes found during the stabilization audit.
-- monday_panel_cache has an RLS policy filtering on teacher_id but no index on it.
-- row_entries.row_id is a FK (Postgres does not auto-index FK columns) and is
-- queried heavily by app/api/teacher/records-of-work/route.ts.

CREATE INDEX IF NOT EXISTS idx_monday_panel_cache_teacher_id
  ON monday_panel_cache (teacher_id);

CREATE INDEX IF NOT EXISTS idx_row_entries_row_id
  ON row_entries (row_id);
