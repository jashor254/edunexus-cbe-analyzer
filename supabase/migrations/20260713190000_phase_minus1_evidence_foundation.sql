-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase -1 — Foundational Evidence Integrity
-- 2026-07-13
--
-- Four additive, blocking schema changes ratified in
-- docs/architecture/learner-record-layer-signoff.md and the roadmap table
-- in docs/architecture/learner-record-layer-decisions.md. Each closes a
-- gap that becomes unrecoverable, not just expensive, once real
-- learner_evidence rows accumulate without it:
--
--   1. curriculum_versions + learner_evidence.curriculum_version_id —
--      nothing previously captured which curriculum edition/grading
--      scale was in effect when evidence was created
--      (learner-record-layer-adversarial-challenge.md, Critical Finding 1).
--   2. learner_evidence.school_id — snapshot at write time; school context
--      was previously only derivable via teachers.school (mutable free
--      text) at read time (learner-record-layer-final-challenge.md §8).
--   3. students.upi — person-level identity anchor, mirroring Core's
--      learners.upi (NEMIS UPI); legacy never had the equivalent
--      (learner-record-layer-final-challenge.md §8).
--   4. Erasure lifecycle state + tombstone columns — legal/right-to-erasure
--      compliance (learner-record-layer-final-challenge.md §8, Critical).
--
-- No existing table is redesigned. No existing row is touched. Every
-- change here is purely additive. Column/trigger definitions below extend
-- 20260707_evidence_domain.sql exactly — nothing in that migration is
-- reopened or reinterpreted, only widened.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CURRICULUM VERSIONS — small, platform-governed reference table.
--    Independent of the not-yet-built evidence_purposes table (Phase G) —
--    Phase -1 must not depend on a later phase.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS curriculum_versions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text        NOT NULL UNIQUE,   -- e.g. 'ke-cbc-2017'
  label           text        NOT NULL,
  curriculum_type text,                            -- e.g. 'cbc', '844' — informational
  country         text,
  effective_from  date,
  effective_to    date,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE curriculum_versions ENABLE ROW LEVEL SECURITY;

-- Platform-governed only: readable by everyone, writable by nobody except
-- the service role (no INSERT/UPDATE/DELETE policy exists for
-- authenticated/anon — same governance shape decided for evidence_purposes
-- in learner-record-layer-decisions.md Decision 2, applied identically
-- here since this is the same "small canonical reference list" pattern).
CREATE POLICY "curriculum_versions_read_all"
  ON curriculum_versions FOR SELECT
  USING (true);

-- Seed the one curriculum this platform currently operates under, so the
-- FK below has something real to reference from day one.
INSERT INTO curriculum_versions (code, label, curriculum_type, country, effective_from)
VALUES ('ke-cbc-2017', 'Kenya CBC (2017 framework)', 'cbc', 'KE', '2017-01-01')
ON CONFLICT (code) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. LEARNER_EVIDENCE — school_id + curriculum_version_id (facts, captured
--    at write time) and the erasure lifecycle state + tombstone columns.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE learner_evidence
  ADD COLUMN IF NOT EXISTS school_id             uuid REFERENCES schools(id),
  ADD COLUMN IF NOT EXISTS curriculum_version_id uuid REFERENCES curriculum_versions(id),
  ADD COLUMN IF NOT EXISTS erased_by             uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS erased_at             timestamptz,
  ADD COLUMN IF NOT EXISTS erasure_reason        text;

CREATE INDEX IF NOT EXISTS idx_learner_evidence_school_id ON learner_evidence (school_id);
CREATE INDEX IF NOT EXISTS idx_learner_evidence_curriculum_version_id ON learner_evidence (curriculum_version_id);

-- Widen the lifecycle_state CHECK to add 'erased'.
ALTER TABLE learner_evidence DROP CONSTRAINT IF EXISTS learner_evidence_lifecycle_state_check;
ALTER TABLE learner_evidence ADD CONSTRAINT learner_evidence_lifecycle_state_check
  CHECK (lifecycle_state IN (
    'auto_confirmed', 'pending_review', 'reviewed_confirmed',
    'reviewed_rejected', 'superseded', 'retracted', 'erased'
  ));

ALTER TABLE evidence_audit_log DROP CONSTRAINT IF EXISTS evidence_audit_log_event_type_check;
ALTER TABLE evidence_audit_log ADD CONSTRAINT evidence_audit_log_event_type_check
  CHECK (event_type IN (
    'created', 'auto_confirmed', 'routed_to_review', 'reviewed_confirmed',
    'reviewed_rejected', 'superseded', 'retracted', 'verification_updated', 'erased'
  ));

-- Replace the immutability trigger from 20260707_evidence_domain.sql:
--   - protects the two new fact columns (school_id, curriculum_version_id)
--     exactly like every other fact column;
--   - adds the ONE documented, actor-attributed, audited exception to fact
--     immutability: erasure may null extracted_name / extracted_external_id
--     / score, and only during the specific transition into 'erased'. Every
--     other fact column, including learner_id, remains protected even
--     during erasure — this purges identifying text fields, it does not
--     unlink the row from the learner or delete it (Evidence Domain Model
--     invariant 3: evidence is never deleted).
CREATE OR REPLACE FUNCTION enforce_evidence_immutability() RETURNS trigger AS $$
DECLARE
  is_erasure boolean := (OLD.lifecycle_state <> 'erased' AND NEW.lifecycle_state = 'erased');
BEGIN
  IF NEW.learner_id                 IS DISTINCT FROM OLD.learner_id
     OR NEW.subject                 IS DISTINCT FROM OLD.subject
     OR NEW.raw_subject             IS DISTINCT FROM OLD.raw_subject
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
     OR NEW.school_id               IS DISTINCT FROM OLD.school_id
     OR NEW.curriculum_version_id   IS DISTINCT FROM OLD.curriculum_version_id
  THEN
    RAISE EXCEPTION 'learner_evidence factual columns are immutable (Evidence Domain Model invariant 2). Create superseding evidence instead of editing row %.', OLD.id;
  END IF;

  IF NOT is_erasure AND (
     NEW.extracted_name          IS DISTINCT FROM OLD.extracted_name
     OR NEW.extracted_external_id IS DISTINCT FROM OLD.extracted_external_id
     OR NEW.score                 IS DISTINCT FROM OLD.score
  ) THEN
    RAISE EXCEPTION 'learner_evidence factual columns are immutable (Evidence Domain Model invariant 2). Create superseding evidence instead of editing row %.', OLD.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Replace the lifecycle-transition trigger from 20260707_evidence_domain.sql:
-- adds 'erased' as reachable from any non-erased state (a right-to-erasure
-- request is not conditional on the evidence's current review status),
-- and forecloses erasing an already-erased row. Every other transition
-- rule is unchanged.
CREATE OR REPLACE FUNCTION enforce_evidence_lifecycle_transition() RETURNS trigger AS $$
BEGIN
  IF NEW.lifecycle_state = OLD.lifecycle_state THEN
    RETURN NEW; -- no state change, e.g. a verification_state-only update
  END IF;

  IF NEW.lifecycle_state = 'erased' THEN
    IF OLD.lifecycle_state = 'erased' THEN
      RAISE EXCEPTION 'learner_evidence row % is already erased.', OLD.id;
    END IF;
    RETURN NEW;
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


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. STUDENTS — person-level identity anchor, mirroring Core learners.upi.
--    Nullable and unpopulated by this migration — resolution/backfill logic
--    is explicitly out of scope (learner-record-layer-final-challenge.md:
--    "reserve the field now, even unpopulated; resolution can wait for
--    real transfer cases in the pilot").
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE students ADD COLUMN IF NOT EXISTS upi text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_upi_unique ON students (upi) WHERE upi IS NOT NULL;
