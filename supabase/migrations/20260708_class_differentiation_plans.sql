-- Classroom Differentiation (Adaptive Learning v2 Architecture §3/§9/§10,
-- docs/architecture/adaptive-learning-v2-architecture.md, FROZEN) — a
-- teacher-facing, per-class differentiation set generated after an
-- assessment, held as a draft until the teacher reviews/adjusts/approves it
-- (same interaction shape as the Holiday Publish Gate,
-- 20260707_holiday_plans_publish_gate.sql).
--
-- Not stored in remedial_plans: that table's sow_id is a mandatory FK to a
-- specific scheme-of-work substrand, which this feature (triggered by any
-- assessment, not a SOW-scoped remediation cycle) doesn't have, and it has
-- no publish/approval columns at all. This table mirrors holiday_plans'
-- proven draft/approve shape instead — additive, no changes to
-- remedial_plans or Remedial Planner, which stay untouched (Migration
-- Ledger: Remedial Planner remains Legacy, unrelated to this table).

CREATE TABLE IF NOT EXISTS class_differentiation_plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id      uuid NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
  teacher_id    uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject       text NOT NULL,
  term          integer NOT NULL,
  year          integer NOT NULL,
  -- Recommendation-Layer-derived groups (Adaptive Learning v2 Architecture
  -- §2/§3): { critical_gap, prerequisite_gap, concept_confusion, on_track,
  -- insufficient_data } -> AdaptiveTask[]. A teacher may edit this JSON
  -- before approval (Review -> Adjust -> Approve); the adjusted version is
  -- what gets persisted here, not silently reverted to the AI's original
  -- proposal.
  plan_data     jsonb NOT NULL,
  is_published  boolean NOT NULL DEFAULT false,
  published_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, subject, term, year)
);

CREATE INDEX IF NOT EXISTS idx_class_differentiation_plans_teacher_id
  ON class_differentiation_plans (teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_differentiation_plans_class_id
  ON class_differentiation_plans (class_id);
CREATE INDEX IF NOT EXISTS idx_class_differentiation_plans_published
  ON class_differentiation_plans (class_id, is_published);

ALTER TABLE class_differentiation_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own class differentiation plans"
  ON class_differentiation_plans FOR ALL
  USING (teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid()))
  WITH CHECK (teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid()));
