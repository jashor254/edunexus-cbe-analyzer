-- ═══════════════════════════════════════════════════════════════════════════════
-- School Effectiveness Check — a school-level Intelligence diagnostic.
-- 2026-10-15 · ADR-0034
--
-- The first school-level (not learner-level) Intelligence artifact. It stores
-- the CBC-Gatsby School Effectiveness Check: per-benchmark maturity ratings
-- (each tagged with whether it was auto-derived from existing canonical data
-- or self-reported) plus the computed profile.
--
-- Ownership (RAS §9 + Operating-Layer ownership rules): Intelligence-owned,
-- never an Operating-table field; non-null school_id; school_users membership
-- RLS pattern; created_by/updated_by from the authenticated actor. Self-report
-- answers are new ground-truth owned here; auto-derived ratings are a cached
-- projection of existing canonical data and are recomputable.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS school_effectiveness_checks (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  -- Which benchmark set produced this Check, so historical Checks are not
  -- silently reinterpreted when the benchmark set evolves. e.g. 'cbc_gatsby_v1'.
  framework_version text        NOT NULL,
  -- Array of { benchmarkId, level (0-4), source: 'auto' | 'self_report' }.
  ratings           jsonb       NOT NULL DEFAULT '[]'::jsonb,
  -- The computed SchoolEffectivenessProfile (overall maturity, prioritised
  -- gaps, recommended programmes, unaddressed gaps, summary).
  profile           jsonb       NOT NULL,
  created_by        uuid        NOT NULL REFERENCES auth.users(id),
  updated_by        uuid        REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- FK indexes (every FK column is indexed).
CREATE INDEX IF NOT EXISTS idx_school_effectiveness_checks_school_id  ON school_effectiveness_checks (school_id);
CREATE INDEX IF NOT EXISTS idx_school_effectiveness_checks_created_by ON school_effectiveness_checks (created_by);
-- "latest Check for a school" is the common read.
CREATE INDEX IF NOT EXISTS idx_school_effectiveness_checks_school_created
  ON school_effectiveness_checks (school_id, created_at DESC);

ALTER TABLE school_effectiveness_checks ENABLE ROW LEVEL SECURITY;

-- School-scoped RLS (RAS Operating-Layer pattern): any active member of the
-- school may read and write its Checks. Role restriction (staff-only writes)
-- is enforced in the Application Layer via lib/core/permissions.ts, not here —
-- RLS does school scoping, the permission service does roles.
CREATE POLICY "school_effectiveness_checks_school_members"
  ON school_effectiveness_checks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = school_effectiveness_checks.school_id
        AND su.user_id = auth.uid()
        AND su.is_active
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = school_effectiveness_checks.school_id
        AND su.user_id = auth.uid()
        AND su.is_active
    )
  );
