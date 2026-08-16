-- Discovered by H1D-3B D1 expansion Wave D (lib/compass/compassAccess.integration.test.ts)
-- via PostgREST's schema cache. Live in production, absent from every
-- tracked migration / loose file that creates student_learning_context locally.

ALTER TABLE student_learning_context
  ADD COLUMN IF NOT EXISTS compass_bridge jsonb,
  ADD COLUMN IF NOT EXISTS sessions_without_improvement integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subject_rest_until timestamptz,
  ADD COLUMN IF NOT EXISTS knowledge_root_causes jsonb,
  ADD COLUMN IF NOT EXISTS knowledge_graph_computed_at timestamptz,
  ADD COLUMN IF NOT EXISTS total_sessions integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sessions_this_week integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS week_start_date date;
