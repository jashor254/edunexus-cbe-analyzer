-- ADR-0024 Sprint B, Objective 2 — let the Evidence Domain preserve
-- canonical curriculum identity, not just free text.
--
-- learner_evidence already has `strand`/`sub_strand` text columns
-- (Projection V2.1) but no column to carry a resolved sow_substrands.id —
-- there was nothing upstream that ever had one to offer, until Sprint A
-- added assignments.substrand_id. This is the parallel FK column on the
-- Evidence side, additive, nullable, exactly mirroring how
-- assignments.substrand_id was added: no backfill, no rewrite of any
-- existing row (every row created before this migration, and every
-- producer not yet updated to populate it, keeps sub_strand_id = null and
-- is entirely unaffected).

ALTER TABLE learner_evidence
  ADD COLUMN IF NOT EXISTS sub_strand_id uuid REFERENCES sow_substrands(id);

CREATE INDEX IF NOT EXISTS idx_learner_evidence_sub_strand_id ON learner_evidence (sub_strand_id) WHERE sub_strand_id IS NOT NULL;
