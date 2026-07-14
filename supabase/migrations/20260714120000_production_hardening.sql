-- ═══════════════════════════════════════════════════════════════════════════════
-- Production Hardening — Learner Record Layer closure
-- 2026-07-14
--
-- Fixes the 4 findings from the Production Hardening Audit. Additive only,
-- no existing table redesigned, no existing row touched.
--
--   1. idempotency_keys — a generic, endpoint-agnostic guard for
--      write-with-side-effect API routes (teacher remarks, promotions).
--      Deliberately NOT a column on learner_evidence or student_promotions:
--      both are ratified, closed schemas (Evidence Domain Model, Phase A)
--      and idempotency is a transport/API concern, not a fact about the
--      learner — keeping it in its own table avoids reopening either.
--   2. idx_assessment_types_default_purpose_id — default_purpose_id
--      (added in Phase G) had no index; it's read on every assessment
--      evidence write (lib/assessments/evidence.ts's
--      findById(...)?.default_purpose_id lookup).
--   3. assessment_types CHECK — exactly one of teacher_id/school_id must be
--      populated. Both nullable today; a row with neither is invisible to
--      every RLS policy (silent orphan), a row with both is ambiguously
--      owned. Existing rows are all teacher-scoped (Phase B backfill), so
--      this is safe to add as NOT VALID-free (all rows already satisfy it).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Generic idempotency guard ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key        text        NOT NULL,
  scope      text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, key)
);

-- Operational/transport state, not tenant data — same shape as job_queues
-- (20260709081538_background_jobs_minimal.sql): accessed only via the
-- service-role client from API routes, which bypasses RLS regardless. No
-- policies: default-deny for anon/authenticated.
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

-- ── 2. Missing index ─────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_assessment_types_default_purpose_id
  ON assessment_types (default_purpose_id);

-- ── 3. Ownership integrity ───────────────────────────────────────────────────

ALTER TABLE assessment_types
  ADD CONSTRAINT assessment_types_exactly_one_owner
  CHECK (
    (teacher_id IS NOT NULL AND school_id IS NULL)
    OR (teacher_id IS NULL AND school_id IS NOT NULL)
  );
