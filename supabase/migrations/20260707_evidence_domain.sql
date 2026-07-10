-- ═══════════════════════════════════════════════════════════════════════════════
-- The Evidence Domain — Phase 2 persistent infrastructure
-- 2026-07-07
--
-- Implements docs/architecture/evidence-domain-model.md as real schema.
-- Evidence exists independently of `assessments` (invariant: Evidence is the
-- source of truth; downstream projections, including `assessments`, are
-- built FROM confirmed evidence in a later phase — not written to here).
--
-- New tables (4): ingestion_runs, learner_evidence, evidence_audit_log,
-- evidence_projection_events.
--
-- Two triggers enforce domain invariants at the database level rather than
-- relying solely on application discipline:
--   - learner_evidence_immutability: factual columns can never change after
--     creation (Evidence Domain Model §3, invariant 2).
--   - learner_evidence_lifecycle_transition: only domain-valid lifecycle
--     transitions are permitted (Evidence Domain Model §2, §12 invariant).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. INGESTION RUNS — every pipeline execution is a first-class object
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source                text        NOT NULL CHECK (source IN (
                          'csv_export', 'excel_import', 'report_card_photo', 'report_card_pdf',
                          'sms_api', 'lms_api', 'teacher_upload', 'parent_observation',
                          'compass_session', 'classroom_observation', 'national_dataset')),
  initiated_by          uuid        NOT NULL REFERENCES auth.users(id),
  teacher_id            uuid        REFERENCES teachers(id),   -- legacy institution proxy
  institution            text,                                  -- teachers.school snapshot at run time
  status                text        NOT NULL DEFAULT 'processing'
                          CHECK (status IN ('processing', 'completed', 'failed')),
  started_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz,
  processing_duration_ms integer,
  record_count          integer     NOT NULL DEFAULT 0,
  confirmed_count       integer     NOT NULL DEFAULT 0,
  pending_review_count  integer     NOT NULL DEFAULT 0,
  rejected_count        integer     NOT NULL DEFAULT 0,
  failure_reason        text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ingestion_runs_teacher_id ON ingestion_runs (teacher_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_status     ON ingestion_runs (status);
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_started_at ON ingestion_runs (started_at);

ALTER TABLE ingestion_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ingestion_runs_own_teacher"
  ON ingestion_runs FOR ALL
  USING (
    initiated_by = auth.uid()
    OR EXISTS (SELECT 1 FROM teachers t WHERE t.id = ingestion_runs.teacher_id AND t.user_id = auth.uid())
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. LEARNER EVIDENCE — the permanent, immutable-content Evidence record
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS learner_evidence (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                timestamptz NOT NULL DEFAULT now(),   -- immutable, per invariant 1

  -- Identity (fact — immutable)
  learner_id                uuid        REFERENCES students(id),  -- nullable: identity may not resolve
  extracted_name            text        NOT NULL,
  extracted_external_id     text,

  -- Claim (fact — immutable)
  subject                   text        NOT NULL,
  raw_subject                text        NOT NULL,
  score                     numeric,
  cbc_level                 smallint    CHECK (cbc_level BETWEEN 1 AND 4),
  assessment_type           text        NOT NULL CHECK (assessment_type IN ('term_exam', 'cat', 'assignment')),
  academic_year             integer     NOT NULL,
  term                      integer     CHECK (term BETWEEN 1 AND 3),

  -- Provenance (fact — immutable)
  evidence_source           text        NOT NULL CHECK (evidence_source IN (
                              'csv_export', 'excel_import', 'report_card_photo', 'report_card_pdf',
                              'sms_api', 'lms_api', 'teacher_upload', 'parent_observation',
                              'compass_session', 'classroom_observation', 'national_dataset')),
  extraction_method         text        NOT NULL,           -- e.g. "csv_parser_v1"
  raw_input_ref             text        NOT NULL,           -- pointer to the specific origin artifact
  ingestion_run_id          uuid        NOT NULL REFERENCES ingestion_runs(id),

  -- Trust and confidence (fact — immutable; frozen snapshots, never recalculated in place)
  trust_tier                smallint    NOT NULL CHECK (trust_tier BETWEEN 1 AND 3),
  evidence_confidence       numeric     NOT NULL CHECK (evidence_confidence BETWEEN 0 AND 100),
  confidence_formula_version text       NOT NULL DEFAULT 'v1',
  issues                    jsonb       NOT NULL DEFAULT '[]'::jsonb,

  -- Lifecycle (mutable envelope — only these columns may change post-creation)
  lifecycle_state           text        NOT NULL CHECK (lifecycle_state IN (
                              'auto_confirmed', 'pending_review', 'reviewed_confirmed',
                              'reviewed_rejected', 'superseded', 'retracted')),
  reviewed_by               uuid        REFERENCES auth.users(id),
  reviewed_at               timestamptz,
  review_reason             text,
  retracted_by              uuid        REFERENCES auth.users(id),
  retracted_at              timestamptz,
  retraction_reason         text,
  supersedes                uuid        REFERENCES learner_evidence(id),
  superseded_by             uuid        REFERENCES learner_evidence(id),
  verification_state        text        NOT NULL DEFAULT 'unverified'
                              CHECK (verification_state IN ('unverified', 'corroborated', 'contradicted', 'externally_verified')),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learner_evidence_learner_id      ON learner_evidence (learner_id);
CREATE INDEX IF NOT EXISTS idx_learner_evidence_ingestion_run   ON learner_evidence (ingestion_run_id);
CREATE INDEX IF NOT EXISTS idx_learner_evidence_lifecycle_state ON learner_evidence (lifecycle_state);
CREATE INDEX IF NOT EXISTS idx_learner_evidence_supersedes      ON learner_evidence (supersedes) WHERE supersedes IS NOT NULL;
-- The "current claim" lookup: same learner+subject+assessment context, not yet superseded/retracted.
CREATE INDEX IF NOT EXISTS idx_learner_evidence_claim_key ON learner_evidence
  (learner_id, subject, assessment_type, academic_year, term)
  WHERE lifecycle_state NOT IN ('superseded', 'retracted', 'reviewed_rejected');

ALTER TABLE learner_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "learner_evidence_own_teacher"
  ON learner_evidence FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM ingestion_runs ir
      WHERE ir.id = learner_evidence.ingestion_run_id
        AND (ir.initiated_by = auth.uid()
             OR EXISTS (SELECT 1 FROM teachers t WHERE t.id = ir.teacher_id AND t.user_id = auth.uid()))
    )
  );

-- Invariant 2: factual columns are immutable once created. Only the lifecycle
-- envelope may change. Enforced here, not just in application code.
CREATE OR REPLACE FUNCTION enforce_evidence_immutability() RETURNS trigger AS $$
BEGIN
  IF NEW.learner_id                 IS DISTINCT FROM OLD.learner_id
     OR NEW.extracted_name          IS DISTINCT FROM OLD.extracted_name
     OR NEW.extracted_external_id   IS DISTINCT FROM OLD.extracted_external_id
     OR NEW.subject                 IS DISTINCT FROM OLD.subject
     OR NEW.raw_subject             IS DISTINCT FROM OLD.raw_subject
     OR NEW.score                   IS DISTINCT FROM OLD.score
     OR NEW.cbc_level                IS DISTINCT FROM OLD.cbc_level
     OR NEW.assessment_type         IS DISTINCT FROM OLD.assessment_type
     OR NEW.academic_year           IS DISTINCT FROM OLD.academic_year
     OR NEW.term                    IS DISTINCT FROM OLD.term
     OR NEW.evidence_source         IS DISTINCT FROM OLD.evidence_source
     OR NEW.extraction_method       IS DISTINCT FROM OLD.extraction_method
     OR NEW.raw_input_ref           IS DISTINCT FROM OLD.raw_input_ref
     OR NEW.ingestion_run_id        IS DISTINCT FROM OLD.ingestion_run_id
     OR NEW.trust_tier              IS DISTINCT FROM OLD.trust_tier
     OR NEW.evidence_confidence     IS DISTINCT FROM OLD.evidence_confidence
     OR NEW.confidence_formula_version IS DISTINCT FROM OLD.confidence_formula_version
     OR NEW.created_at              IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'learner_evidence factual columns are immutable (Evidence Domain Model invariant 2). Create superseding evidence instead of editing row %.', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_learner_evidence_immutability
  BEFORE UPDATE ON learner_evidence
  FOR EACH ROW EXECUTE FUNCTION enforce_evidence_immutability();

-- Invariant: lifecycle transitions must follow the state machine in
-- Evidence Domain Model §2. Applies to UPDATEs only — the initial INSERT
-- sets lifecycle_state directly to auto_confirmed or pending_review, which
-- is not a "transition" from anything.
CREATE OR REPLACE FUNCTION enforce_evidence_lifecycle_transition() RETURNS trigger AS $$
BEGIN
  IF NEW.lifecycle_state = OLD.lifecycle_state THEN
    RETURN NEW; -- no state change, e.g. a verification_state-only update
  END IF;

  IF NOT (
    (OLD.lifecycle_state = 'pending_review'    AND NEW.lifecycle_state IN ('reviewed_confirmed', 'reviewed_rejected')) OR
    (OLD.lifecycle_state = 'auto_confirmed'     AND NEW.lifecycle_state IN ('superseded', 'retracted')) OR
    (OLD.lifecycle_state = 'reviewed_confirmed' AND NEW.lifecycle_state IN ('superseded', 'retracted'))
  ) THEN
    RAISE EXCEPTION 'Invalid evidence lifecycle transition % -> % on row % (Evidence Domain Model §2).', OLD.lifecycle_state, NEW.lifecycle_state, OLD.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_learner_evidence_lifecycle_transition
  BEFORE UPDATE ON learner_evidence
  FOR EACH ROW EXECUTE FUNCTION enforce_evidence_lifecycle_transition();


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. EVIDENCE AUDIT LOG — the ordered history of every lifecycle transition
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS evidence_audit_log (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id    uuid        NOT NULL REFERENCES learner_evidence(id),
  event_type     text        NOT NULL CHECK (event_type IN (
                   'created', 'auto_confirmed', 'routed_to_review', 'reviewed_confirmed',
                   'reviewed_rejected', 'superseded', 'retracted', 'verification_updated')),
  actor          text        NOT NULL,   -- 'system' or a user id string
  occurred_at    timestamptz NOT NULL DEFAULT now(),
  reason         text,
  previous_state text,
  new_state      text        NOT NULL,
  metadata       jsonb       NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_evidence_audit_log_evidence_id ON evidence_audit_log (evidence_id);
CREATE INDEX IF NOT EXISTS idx_evidence_audit_log_occurred_at ON evidence_audit_log (occurred_at);

ALTER TABLE evidence_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evidence_audit_log_own_teacher"
  ON evidence_audit_log FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM learner_evidence le
      JOIN ingestion_runs ir ON ir.id = le.ingestion_run_id
      WHERE le.id = evidence_audit_log.evidence_id
        AND (ir.initiated_by = auth.uid()
             OR EXISTS (SELECT 1 FROM teachers t WHERE t.id = ir.teacher_id AND t.user_id = auth.uid()))
    )
  );

-- Audit log is append-only — no update or delete policy is granted, and no
-- application code should ever attempt either.
REVOKE UPDATE, DELETE ON evidence_audit_log FROM authenticated, anon;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. EVIDENCE PROJECTION EVENTS — hooks for downstream recomputation
--    (no consumer implemented yet — this phase only provides the outbox)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS evidence_projection_events (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id  uuid        NOT NULL REFERENCES learner_evidence(id),
  learner_id   uuid        NOT NULL REFERENCES students(id),
  event_type   text        NOT NULL CHECK (event_type IN ('evidence_confirmed', 'evidence_retracted', 'evidence_superseded')),
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,   -- null = not yet consumed by a projection recomputation job
  metadata     jsonb       NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_evidence_projection_events_unprocessed
  ON evidence_projection_events (learner_id) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_evidence_projection_events_evidence_id ON evidence_projection_events (evidence_id);

ALTER TABLE evidence_projection_events ENABLE ROW LEVEL SECURITY;

-- Internal/system table — no direct end-user access; service role only.
CREATE POLICY "evidence_projection_events_service_only"
  ON evidence_projection_events FOR ALL
  USING (false);
