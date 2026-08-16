-- Historical column gaps found empirically during replay (H1M-FIX/H1M-SNAPSHOT):
-- no repo migration adds these, but earlier tracked migrations (performance_indexes,
-- eios_foundation) already assume their presence. Recovered from live production
-- structure (information_schema.columns), minus later-known additions where identified.

-- row_entries: needed by 20260525_performance_indexes.sql's idx_row_entries_status
ALTER TABLE row_entries
  ADD COLUMN IF NOT EXISTS learning_outcomes jsonb,
  ADD COLUMN IF NOT EXISTS key_inquiry_questions jsonb,
  ADD COLUMN IF NOT EXISTS learning_resources jsonb,
  ADD COLUMN IF NOT EXISTS activities_summary jsonb,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS remarks text;

-- learner_profiles: needed by 20260628_eios_foundation.sql's
-- idx_learner_profiles_risk index
ALTER TABLE learner_profiles
  ADD COLUMN IF NOT EXISTS overall_risk_level text,
  ADD COLUMN IF NOT EXISTS risk_flags jsonb;

-- compass_sessions: final_schema.sql's original form (id, learner_id,
-- session_state, last_subject, created_at, updated_at) predates a long
-- sequence of production ALTERs no repo file individually captures.
-- Needed by 20260619_compass_perf_indexes.sql's composite index.
ALTER TABLE compass_sessions
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS message_count integer,
  ADD COLUMN IF NOT EXISTS one_line_summary text,
  ADD COLUMN IF NOT EXISTS exchange_count integer,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS mode text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS xp_earned integer,
  ADD COLUMN IF NOT EXISTS starting_level integer,
  ADD COLUMN IF NOT EXISTS ending_level integer;
