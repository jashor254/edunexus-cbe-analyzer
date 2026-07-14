-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase C — Teacher Remarks as Evidence
-- 2026-07-13
--
-- Implements docs/architecture/learner-record-layer-decisions.md Decision 1
-- (the payload jsonb design) and Decision 4-of-learner-record-layer.md
-- (teacher remarks as a tenth EvidenceSource, corrected from an earlier,
-- withdrawn standalone-table proposal). Additive only.
--
--   1. learner_evidence.evidence_source CHECK widened to add
--      'teacher_remark'.
--   2. learner_evidence.payload jsonb — the one shared column narrative/
--      non-scored evidence writes into (a payload_version field lives
--      inside the JSON itself, not as a separate DB column, per the
--      adversarial-challenge review). Protected under the same
--      fact-immutability rule as extracted_name/extracted_external_id/
--      score: a remark is corrected via retraction + a new remark, never
--      edited in place — except during the one documented exception,
--      erasure, which purges payload too, since a remark's actual
--      sensitive content lives there, not in extracted_name.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE learner_evidence DROP CONSTRAINT IF EXISTS learner_evidence_evidence_source_check;
ALTER TABLE learner_evidence ADD CONSTRAINT learner_evidence_evidence_source_check
  CHECK (evidence_source IN (
    'csv_export', 'excel_import', 'report_card_photo', 'report_card_pdf',
    'sms_api', 'lms_api', 'teacher_upload', 'parent_observation',
    'compass_session', 'classroom_observation', 'national_dataset',
    'holiday_return', 'teacher_remark'
  ));

ALTER TABLE learner_evidence ADD COLUMN IF NOT EXISTS payload jsonb;

-- Replace the immutability trigger (from 20260707_evidence_domain.sql,
-- already widened once in Phase -1 and again in Phase G) to also protect
-- `payload` as a fact column — a remark's body is corrected via retraction
-- + a new remark, never edited in place, same as every other fact.
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
     OR NEW.purpose_id              IS DISTINCT FROM OLD.purpose_id
  THEN
    RAISE EXCEPTION 'learner_evidence factual columns are immutable (Evidence Domain Model invariant 2). Create superseding evidence instead of editing row %.', OLD.id;
  END IF;

  -- `payload` is included in the erasure exception here, not left for a
  -- future migration: teacher remarks (this phase) store their actual
  -- sensitive content — the narrative body — in `payload`, not in
  -- `extracted_name`. Without this, "erasing" a remark would purge an
  -- essentially empty field while leaving its real content fully intact —
  -- caught during implementation of this exact phase, not before, because
  -- payload didn't exist to reason about until now.
  IF NOT is_erasure AND (
     NEW.extracted_name          IS DISTINCT FROM OLD.extracted_name
     OR NEW.extracted_external_id IS DISTINCT FROM OLD.extracted_external_id
     OR NEW.score                 IS DISTINCT FROM OLD.score
     OR NEW.payload                IS DISTINCT FROM OLD.payload
  ) THEN
    RAISE EXCEPTION 'learner_evidence factual columns are immutable (Evidence Domain Model invariant 2). Create superseding evidence instead of editing row %.', OLD.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
