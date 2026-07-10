-- ═══════════════════════════════════════════════════════════════════════════════
-- Learner Intelligence Projections — the derived, disposable, rebuildable
-- output of the Projection Engine.
-- 2026-07-07
--
-- Deliberate contrast with learner_evidence: Evidence is immutable and
-- permanent. Projections are explicitly disposable — upserted on every
-- recompute, deletable, and always fully reconstructible from Evidence
-- alone (docs/architecture — Learner Intelligence Projection Engine).
--
-- One row per (learner_id, projector_type): the current computed output of
-- that projector for that learner. No history is kept here on purpose —
-- history lives in Evidence; this table is a cache, not a record.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS learner_projections (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id              uuid        NOT NULL REFERENCES students(id),
  projector_type          text        NOT NULL CHECK (projector_type IN (
                            'academic', 'capability', 'knowledge', 'behaviour',
                            'growth', 'risk', 'completeness')),
  projection_version      text        NOT NULL,
  value                   jsonb       NOT NULL,
  supporting_evidence_ids uuid[]      NOT NULL DEFAULT '{}',
  confidence              numeric     NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  evidence_count          integer     NOT NULL DEFAULT 0,
  evidence_diversity      integer     NOT NULL DEFAULT 0,
  latest_evidence_at      timestamptz,
  oldest_evidence_at      timestamptz,
  coverage                numeric     CHECK (coverage IS NULL OR coverage BETWEEN 0 AND 100),
  freshness_days          numeric,
  last_computed           timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (learner_id, projector_type)
);

CREATE INDEX IF NOT EXISTS idx_learner_projections_learner_id ON learner_projections (learner_id);
CREATE INDEX IF NOT EXISTS idx_learner_projections_type       ON learner_projections (projector_type);

ALTER TABLE learner_projections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "learner_projections_own_students"
  ON learner_projections FOR ALL
  USING (
    EXISTS (SELECT 1 FROM students s WHERE s.id = learner_projections.learner_id AND s.teacher_id IN (
      SELECT id FROM teachers WHERE user_id = auth.uid()
    ))
    OR EXISTS (SELECT 1 FROM students s WHERE s.id = learner_projections.learner_id AND s.parent_user_id = auth.uid())
  );
