-- ─── COS Phase 1: Capability Engine ──────────────────────────────────────────
-- Adds intelligence columns to careers + students, and creates capability_history

-- ── careers: COS intelligence fields ─────────────────────────────────────────

ALTER TABLE careers
  ADD COLUMN IF NOT EXISTS required_capabilities      jsonb,
  ADD COLUMN IF NOT EXISTS capability_cluster         text[],
  ADD COLUMN IF NOT EXISTS difficulty                 text CHECK (difficulty IN ('accessible','moderate','hard','very_hard')),
  ADD COLUMN IF NOT EXISTS kenya_demand               text CHECK (kenya_demand IN ('critical_shortage','undersupplied','balanced','saturated')),
  ADD COLUMN IF NOT EXISTS saturation_note            text,
  ADD COLUMN IF NOT EXISTS kcse_minimum               jsonb,
  ADD COLUMN IF NOT EXISTS time_to_income_years       integer,
  ADD COLUMN IF NOT EXISTS cost_to_qualify            jsonb,
  ADD COLUMN IF NOT EXISTS risk_level                 text CHECK (risk_level IN ('low','medium','high','variable')),
  ADD COLUMN IF NOT EXISTS prestige_level             smallint CHECK (prestige_level BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS social_reality             jsonb,
  ADD COLUMN IF NOT EXISTS alternative_career_slugs   text[],
  ADD COLUMN IF NOT EXISTS complementary_career_slugs text[];

-- ── students: computed capability profile ─────────────────────────────────────

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS capability_profile     jsonb,
  ADD COLUMN IF NOT EXISTS capability_computed_at timestamptz;

-- ── capability_history: time-series capability snapshots ──────────────────────

CREATE TABLE IF NOT EXISTS capability_history (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id         uuid        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  capability_profile jsonb       NOT NULL,
  assessment_count   integer     NOT NULL DEFAULT 0,
  computed_at        timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capability_history_student_id  ON capability_history(student_id);
CREATE INDEX IF NOT EXISTS idx_capability_history_computed_at ON capability_history(computed_at);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE capability_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "capability_history_read_own"
  ON capability_history FOR SELECT
  USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

CREATE POLICY "capability_history_service_insert"
  ON capability_history FOR INSERT
  WITH CHECK (true);
