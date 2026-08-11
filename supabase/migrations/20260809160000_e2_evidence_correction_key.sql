-- Phase E2 / S1 — correction_key foundation on learner_evidence.
--
-- PURPOSE
-- The Evidence Domain currently infers "this is a correction" from a
-- six-field claim key (learner, subject, sub-strand, assessment type, year,
-- term). That answers "is this newer evidence about the same curriculum
-- area?", which is a different question, and the production data shows the
-- cost: of 55 supersession chains, ~32 are accidental collisions between
-- INDEPENDENT observations — every one of the 18 quiz chains is between two
-- different quizzes, and 14 of the 23 teacher_upload chains are between two
-- different class assessments. Those learners lost real observations from
-- their confirmed record.
--
-- `correction_key` is an optional, immutable, producer-declared identifier
-- of the underlying educational ARTIFACT. NULL means "an independent
-- observation, which never automatically supersedes anything" — the honest
-- answer for every observation-only producer (formative signals, parent
-- observations, intervention check-ins, holiday returns) and for every
-- historical row.
--
-- BEHAVIOURALLY INERT IN E2. Nothing reads this column to decide
-- supersession yet: `claimKey()` and `findCurrentEvidenceForClaim()` are
-- untouched and still drive every supersession decision. E3 measures the
-- disagreement between the two rules; E4 decides the cutover. This
-- migration only lets the domain KNOW which rows belong to the same
-- correctable artifact.
--
-- LIVE PREFLIGHT (verified against production immediately before applying)
--   - learner_evidence: 1,016 rows, 55 supersession chains — matches the
--     Phase E1 audit exactly
--   - no column of this purpose exists (probed correction_key, artifact_key,
--     correction_id: all absent)
--   - RLS enabled, 1 policy, 10 indexes
--   - triggers: trg_learner_evidence_immutability,
--     trg_learner_evidence_lifecycle_transition
--
-- SAFETY
--   - ADDITIVE and NULLABLE. All 1,016 existing rows stay valid and stay
--     NULL. NO BACKFILL: deriving keys from `raw_input_ref` would
--     retroactively invent correction relationships nobody asserted and would
--     silently legitimise the 32 known-bad chains. Historical remediation is
--     a separate educational-data decision.
--   - NOT UNIQUE. A correction chain legitimately contains several rows
--     sharing one key; uniqueness would forbid the very thing this enables.
--   - NOT a foreign key. The key spans several artifact tables by namespace;
--     no single FK target exists.
--   - NO RLS CHANGE, NO GRANT CHANGE. A nullable column does not alter
--     policy evaluation.
--   - The index is partial: only keyed rows are ever looked up by it, and
--     today that is zero rows.
--
-- ROLLBACK
--   DROP INDEX IF EXISTS idx_learner_evidence_correction_key;
--   ALTER TABLE learner_evidence DROP COLUMN IF EXISTS correction_key;
--   -- and restore enforce_evidence_immutability() without the
--   -- correction_key clause (the rest of the function is unchanged here).

ALTER TABLE learner_evidence
  ADD COLUMN IF NOT EXISTS correction_key text;

COMMENT ON COLUMN learner_evidence.correction_key IS
  'Immutable, producer-declared identity of the underlying correctable artifact (e.g. assignment_mark:<assignment>:<student>). NULL = an independent observation that never automatically supersedes. Never contains mutable values (score, level, outcome, review state, timestamp). Not read for supersession decisions until Phase E4.';

-- Lookup shape a future correction-scoped supersession query needs:
-- same learner AND same producer AND same artifact (Phase E1 §13 — the
-- source is part of the scope so a low-trust producer can never supersede
-- another producer's artifact by supplying its key).
CREATE INDEX IF NOT EXISTS idx_learner_evidence_correction_key
  ON learner_evidence (learner_id, evidence_source, correction_key)
  WHERE correction_key IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- Immutability — EXTENDS the existing trigger function rather than adding a
-- second, competing mechanism. `correction_key` joins the same factual
-- column list that already protects `purpose_id`, `raw_input_ref` and the
-- rest of a row's provenance: a correction identity that could be edited
-- after insert would let history be rewritten, which is exactly what
-- Evidence Domain Model invariant 2 forbids. Every other clause below is
-- reproduced verbatim from the live definition — nothing else changes.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_evidence_immutability()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
     OR NEW.correction_key          IS DISTINCT FROM OLD.correction_key
  THEN
    RAISE EXCEPTION 'learner_evidence factual columns are immutable (Evidence Domain Model invariant 2). Create superseding evidence instead of editing row %.', OLD.id;
  END IF;

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
$function$;
