-- H5A-3 — Downstream Document Curriculum Provenance, lesson_plans.
--
-- PURPOSE
-- H5A-2 gave scheme_lessons a canonical curriculum anchor
-- (sub_strand_id -> sow_substrands.id). This migration gives lesson_plans
-- the same anchor, populated directly from GeneratedLesson.substrandId at
-- generation time (lib/lessonPlan/weeklyGenerator.ts's savePlans()) — the
-- exact value the teacher's picker resolved, never re-derived from
-- strand/sub_strand text.
--
-- OWNERSHIP DECISION (the actual work of this migration, not just its DDL)
-- H5A-3 audited whether lesson_plans could instead RECOVER curriculum
-- identity from its parent via a join, rather than storing its own copy —
-- the schema minimality principle this phase is governed by. It cannot,
-- for a concrete, evidenced reason, not a preference:
--
--   lesson_plans.sow_id REFERENCES schemes_of_work(id) ON DELETE SET NULL
--   (20260530_sow_tables.sql) — a lesson_plan is DESIGNED to survive its
--   parent scheme's deletion, orphaned but intact. A join-based recovery
--   (lesson_plans.sow_id + week_number + lesson_number ->
--   scheme_lessons.scheme_id + week + lesson) would work only until a
--   teacher deletes the originating scheme — exactly the moment this
--   table's own FK behaviour was built to survive. Recovery would go
--   silently, permanently blank for every lesson plan whose scheme was
--   later deleted, which defeats the entire purpose of ON DELETE SET NULL
--   over ON DELETE CASCADE here.
--
-- This is not "we added one FK, so add one everywhere" — see the sibling
-- decision on row_entries (H5A-3 closeout, deliberately NOT migrated this
-- phase: its provenance is genuinely ambiguous, seeded from EITHER
-- lesson_plans OR scheme_lessons per scheme with the choice never
-- recorded anywhere, so there is no single parent to join through or copy
-- from without inventing an answer this phase is not authorized to
-- invent).
--
-- LIVE PREFLIGHT (verified against this repository before writing this
-- file)
--   - lesson_plans exists (20260530_sow_tables.sql), no column of this
--     purpose under any name.
--   - sow_substrands.id is the same established FK target already used by
--     assignments.substrand_id, learner_evidence.sub_strand_id,
--     blueprint_action_items.sub_strand_id and (H5A-2)
--     scheme_lessons.sub_strand_id.
--   - lib/lessonPlan/weeklyGenerator.ts's savePlans() is the sole INSERT
--     writer of lesson_plans in the entire codebase (grep-verified via
--     lib/repositories/curriculum.repository.ts's insertLessonPlans, its
--     only caller).
--   - GeneratedLesson.substrandId (added H5A-2) is already present on the
--     `lesson` object savePlans() receives — no new plumbing needed
--     upstream of this migration, only the INSERT payload itself.
--
-- SAFETY
--   - ADDITIVE and NULLABLE. Every existing lesson_plans row stays valid
--     and stays text-only. Historical rows are NOT backfilled: the same
--     "strand/sub_strand text is not guaranteed to match sow_substrands
--     verbatim" reasoning as every prior sub_strand_id migration applies
--     here identically.
--   - IDEMPOTENT (IF NOT EXISTS on both the column and the index).
--   - NO RLS CHANGE. lesson_plans keeps its existing policies (ownership
--     keyed on teacher_id, unaffected by an additional nullable column).
--   - NO GRANT CHANGE.
--   - ON DELETE RESTRICT, matching scheme_lessons.sub_strand_id
--     (H5A-2) and blueprint_action_items.sub_strand_id — sow_substrands
--     rows are read-only reference data everywhere they're touched, so
--     RESTRICT exists to fail loudly, not to fire in practice.
--
-- SEMANTICS (see docs/architecture/curriculum-identity-invariants.md)
-- lesson_plans.sub_strand_id means exactly: "the canonical curriculum
-- sub-strand this lesson plan's originating GeneratedLesson carried at
-- generation time." It is a snapshot, not a live pointer — a later edit to
-- the parent scheme_lesson's own strand/substrand text (scheme_lessons
-- supports teacher edits via PATCH /api/schemes/[id]) does NOT retroactively
-- change an already-generated lesson_plan's identity, by design: a lesson
-- plan is a historical/generated artifact, not a projection of its parent.
-- NULL means the identity was never known upstream, never "an error."
--
-- ROLLBACK
--   ALTER TABLE lesson_plans DROP COLUMN IF EXISTS sub_strand_id;
--   (Safe: nothing reads it before the H5A-3 application code ships, and
--   dropping it returns every row to text-only identity — current
--   behaviour.)
--
-- SCOPE
-- This file changes exactly one thing. It does not touch row_entries (see
-- H5A-3 closeout §7 — a genuine product/schema decision, not decided
-- here) and performs no unrelated schema repair.

ALTER TABLE lesson_plans
  ADD COLUMN IF NOT EXISTS sub_strand_id uuid
  REFERENCES sow_substrands(id) ON DELETE RESTRICT;

COMMENT ON COLUMN lesson_plans.sub_strand_id IS
  'Canonical curriculum anchor (sow_substrands.id) carried from this lesson plan''s originating GeneratedLesson at generation time, or NULL when no canonical identity was available. A snapshot, not a live pointer to the parent scheme_lesson — never re-derived from strand/sub_strand text, never updated after the plan is created.';

-- Partial index: only anchored rows are ever looked up by this, matching
-- the same partial-index pattern used by every prior sub_strand_id FK.
CREATE INDEX IF NOT EXISTS idx_lesson_plans_sub_strand_id
  ON lesson_plans (sub_strand_id)
  WHERE sub_strand_id IS NOT NULL;
