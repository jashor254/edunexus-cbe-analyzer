-- TIE Phase 1c: remedial_actions table
-- Stores AI-generated Quick Check content for sub-strands flagged in weekly intelligence.
-- Resolution is tracked via weekly health score changes — no status column needed.
-- Apply with: supabase db push --linked

CREATE TABLE IF NOT EXISTS remedial_actions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sow_id                uuid NOT NULL REFERENCES schemes_of_work(id) ON DELETE CASCADE,
  teacher_id            uuid NOT NULL,
  substrand_health_id   uuid REFERENCES substrand_health(id) ON DELETE SET NULL,
  week_of               date NOT NULL,
  strand                text NOT NULL,
  sub_strand            text NOT NULL,
  root_cause            text,
  suggested_activity    text NOT NULL,
  questions             jsonb NOT NULL DEFAULT '[]',
  generated_at          timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_remedial_actions_teacher_id          ON remedial_actions (teacher_id);
CREATE INDEX IF NOT EXISTS idx_remedial_actions_sow_id              ON remedial_actions (sow_id);
CREATE INDEX IF NOT EXISTS idx_remedial_actions_substrand_health_id ON remedial_actions (substrand_health_id);

ALTER TABLE remedial_actions ENABLE ROW LEVEL SECURITY;

-- teacher_id stores auth user id (mirrors substrand_health pattern)
CREATE POLICY "teacher_own_remedial_actions"
  ON remedial_actions FOR ALL
  USING (teacher_id = auth.uid());
