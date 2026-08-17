-- H5A-2 — Curriculum Identity Preservation Contract, SOW persistence anchor.
--
-- PURPOSE
-- A teacher's SOW picker already resolves a real sow_substrands.id
-- (SelectedSubstrand.substrandId, lib/sow/types.ts) before generation ever
-- starts. H5A-1 traced that identity and proved it is discarded at
-- lib/sow/lessonAllocator.ts — AllocatedLesson carries strand/substrand
-- TEXT only — and every downstream artifact (scheme_lessons, lesson_plans,
-- row_entries) inherits that loss. This migration gives scheme_lessons —
-- the one normalized, per-lesson row both Lesson Plan generation and
-- Record of Work seeding read from — the same kind of FK anchor that
-- assignments.substrand_id, learner_evidence.sub_strand_id and
-- blueprint_action_items.sub_strand_id already carry. It introduces no new
-- curriculum concept: sow_substrands.id is already the established FK
-- target for exactly this purpose.
--
-- LIVE PREFLIGHT (verified against this repository before writing this
-- file, per H5A-2's own re-audit requirement)
--   - scheme_lessons exists (20260530_sow_tables.sql), no column of this
--     purpose under any name — probed for sub_strand_id, substrand_id,
--     curriculum_id, sow_substrand_id, all ABSENT (confirmed via
--     lib/database.types.ts and every tracked migration touching
--     scheme_lessons).
--   - sow_substrands exists, primary key `id` uuid — the same FK target
--     already used by assignments.substrand_id, learner_evidence.sub_strand_id
--     and blueprint_action_items.sub_strand_id.
--   - app/api/sow/save/route.ts is the sole INSERT writer of scheme_lessons
--     in the entire codebase (grep-verified) — no other writer needs
--     updating for this column to be populated correctly.
--
-- SAFETY
--   - ADDITIVE and NULLABLE. Every existing scheme_lessons row stays valid
--     and stays text-only. Historical rows are NOT backfilled: inferring a
--     sub-strand from the existing `strand`/`substrand` free text (which is
--     AI-generated per lesson, not guaranteed to match sow_substrands.title
--     verbatim) would be exactly the guessed curriculum mapping this
--     platform's own architecture explicitly forbids — a lesson generated
--     before this migration was generated with text-only identity, and
--     stays that way.
--   - IDEMPOTENT (IF NOT EXISTS on both the column and the index).
--   - NO RLS CHANGE. scheme_lessons keeps its existing policies
--     ("scheme_lessons: own via sow", "scheme_lessons: service role",
--     20260530_sow_tables.sql) — both key off scheme_id/schemes_of_work
--     ownership, not any lesson-content column. Adding a nullable column
--     does not alter policy evaluation. Writes already go through the
--     service client in app/api/sow/save/route.ts.
--   - NO GRANT CHANGE.
--   - ON DELETE RESTRICT, matching the most recent precedent
--     (blueprint_action_items.sub_strand_id,
--     20260809120000_phase2_blueprint_action_curriculum_identity.sql): a
--     sub-strand that a teacher's saved scheme lesson points at must not
--     vanish silently underneath it. sow_substrands rows are read-only
--     reference data in every code path that touches them (no DELETE
--     against sow_* found anywhere in lib/ or app/), so RESTRICT never
--     fires in practice — it exists to fail loudly, not silently, if that
--     ever changes.
--
-- SEMANTICS (see docs/architecture/curriculum-identity-invariants.md)
-- scheme_lessons.sub_strand_id means exactly: "the canonical curriculum
-- sub-strand explicitly selected upstream, before generation, for this
-- lesson." It does NOT mean: a best text match, an AI-inferred curriculum
-- outcome, learning-outcome-level mastery, a learner's grade, or a
-- curriculum-version identity. NULL means the identity was never known
-- upstream (a NULL canonical identity is safer than a guessed one) — it
-- does not mean "curriculum-generic" or "an error."
--
-- ROLLBACK
--   ALTER TABLE scheme_lessons DROP COLUMN IF EXISTS sub_strand_id;
--   (Safe: nothing reads it before the H5A-2 application code ships, and
--   dropping it returns every row to text-only identity — the current
--   behaviour.)
--
-- SCOPE
-- This file changes exactly one thing. It does not touch lesson_plans or
-- row_entries (see H5A-2 closeout §12/§19 — a possible H5A-3 candidate,
-- not decided here) and performs no unrelated schema repair.

ALTER TABLE scheme_lessons
  ADD COLUMN IF NOT EXISTS sub_strand_id uuid
  REFERENCES sow_substrands(id) ON DELETE RESTRICT;

COMMENT ON COLUMN scheme_lessons.sub_strand_id IS
  'Canonical curriculum anchor (sow_substrands.id) explicitly selected upstream by the teacher before generation, or NULL when no canonical identity was available. Never inferred from strand/substrand free text.';

-- Partial index: only anchored rows are ever looked up by this, matching
-- the same partial-index pattern used by every prior sub_strand_id FK.
CREATE INDEX IF NOT EXISTS idx_scheme_lessons_sub_strand_id
  ON scheme_lessons (sub_strand_id)
  WHERE sub_strand_id IS NOT NULL;
