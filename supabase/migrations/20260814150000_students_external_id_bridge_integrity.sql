-- IDENTITY-1 Phase 2 — bridge integrity.
--
-- `students.external_id` was designed to serve two purposes:
--   1. The Core learner bridge: `external_id = learners.id::text`,
--      `integration_connection_id IS NULL`.
--   2. External-integration identity: `integration_connection_id IS NOT NULL`,
--      already covered by the existing `uq_students_connection_external`
--      index (`UNIQUE (integration_connection_id, external_id) WHERE both NOT
--      NULL`).
--
-- Purpose 2 is real (a genuine FK to `integration_connections` exists) but
-- dormant — 0 rows in `integration_connections`, 0 rows in `students` with
-- `integration_connection_id` set, 0 code references anywhere in the
-- repository. Purpose 1 has NO uniqueness constraint at all: today's 429
-- distinct bridge values are incidental, not enforced. A second `students`
-- row could claim an already-bridged `learners.id` and nothing in the
-- database would refuse it — `ensureBridgedLearner`'s find-then-insert
-- happens to prevent this in the one production writer, but that is
-- application discipline, not a guarantee.
--
-- This adds exactly the constraint purpose 1 is missing, scoped so it can
-- never govern a purpose-2 row once that path is implemented.
--
-- Verified before this migration (IDENTITY-1 Phase 2, 2026-08-14):
--   students: 668, learners: 853, external_id populated: 429, malformed: 0,
--   duplicate external_id: 0, dangling (no matching learner): 9 — all synthetic
--   debug rows named "Debug Learner" / "Bridge Learner" / "Lock Learner",
--   added_by='system', created in a 6-day integration-test window. None
--   duplicate each other, so none block this index. Mwatate Ridge
--   (the only real school with volume): 407 learners, 407 bridged, 0 dangling,
--   0 duplicates, independently re-verified.

create unique index if not exists uq_students_external_id_bridge
  on public.students (external_id)
  where integration_connection_id is null and external_id is not null;

comment on index uq_students_external_id_bridge is
  'IDENTITY-1 Phase 2: enforces the Core learner bridge is 1:1 — one students row per learners.id. Scoped to integration_connection_id IS NULL so it never governs an external-integration row (see uq_students_connection_external for that case, which already exists).';
