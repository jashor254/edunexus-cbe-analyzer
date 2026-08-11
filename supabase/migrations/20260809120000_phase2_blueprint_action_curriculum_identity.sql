-- Phase 2 / Migration A — curriculum identity on Blueprint action items.
--
-- PURPOSE
-- A Blueprint action item is where an evidence-derived learner need becomes
-- a teacher-approved instruction. Until now it could only say "Mathematics":
-- `target_capability` is free text, and there was no stable curriculum
-- identifier anywhere on the row. So the specific sub-strand a weakness was
-- identified in (`learner_projections.academic.bySubStrand`, keyed on
-- `sow_substrands.id`) was discarded the moment a candidate was persisted,
-- and every downstream hop — Compass delivery, assignment delivery, the
-- resulting evidence — could only work at subject grain.
--
-- This column carries that existing identifier through. It introduces no new
-- curriculum concept: `sow_substrands.id` is already the canonical anchor
-- used by `assignments.substrand_id` and `learner_evidence.sub_strand_id`.
--
-- LIVE PREFLIGHT (verified against production before writing this file)
--   - blueprint_action_items exists, 784 rows
--     (approved 400, proposed 235, rejected 59, edited 46, deferred 44)
--   - no column of this purpose exists under any name — probed for
--     sub_strand_id, substrand_id, curriculum_id and sow_substrand_id,
--     all ABSENT
--   - sow_substrands exists, 18,789 rows, primary key `id`
--   - assignments.substrand_id already references the same space, so this
--     is an established FK target, not a new relationship
--
-- SAFETY
--   - ADDITIVE and NULLABLE. Every one of the 784 existing rows stays valid
--     and stays subject-level. Historical actions are NOT backfilled:
--     inferring a sub-strand from `target_capability` free text would be a
--     guessed curriculum mapping, which is explicitly forbidden — an action
--     that was authored at subject grain was authored at subject grain.
--   - IDEMPOTENT (IF NOT EXISTS on both the column and the index).
--   - NO RLS CHANGE. blueprint_action_items keeps its existing policies
--     (read-only RLS per 20260727090000_core_academic_rls_write_hardening;
--     writes go through the service client in lib/learnerBlueprint/actionPlan).
--     Adding a nullable column does not alter policy evaluation.
--   - NO GRANT CHANGE.
--   - ON DELETE RESTRICT, matching how curriculum rows are treated
--     elsewhere: a sub-strand that an approved teacher action points at must
--     not vanish silently underneath it.
--
-- ROLLBACK
--   ALTER TABLE blueprint_action_items DROP COLUMN IF EXISTS sub_strand_id;
--   (Safe: nothing reads it before the Phase 2 application code ships, and
--   dropping it returns every row to subject grain — the current behaviour.)
--
-- SCOPE
-- This file changes exactly one thing. It is deliberately NOT combined with
-- the Gate B review-semantics work (which required no migration at all), and
-- it performs no unrelated schema repair or migration-history reconciliation.

ALTER TABLE blueprint_action_items
  ADD COLUMN IF NOT EXISTS sub_strand_id uuid
  REFERENCES sow_substrands(id) ON DELETE RESTRICT;

COMMENT ON COLUMN blueprint_action_items.sub_strand_id IS
  'Canonical curriculum anchor (sow_substrands.id) this action targets, or NULL for a subject-level action. Never inferred from target_capability free text.';

-- Partial index: only anchored rows are ever looked up by this, and today
-- that is a small minority of the table.
CREATE INDEX IF NOT EXISTS idx_blueprint_action_items_sub_strand_id
  ON blueprint_action_items (sub_strand_id)
  WHERE sub_strand_id IS NOT NULL;
