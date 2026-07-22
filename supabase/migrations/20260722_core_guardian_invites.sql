-- ═══════════════════════════════════════════════════════════════════════════════
-- Sprint 12 Wave 3 (Critical 1, Release Blocker Remediation)
--
-- Closes the Release Candidate audit's Critical finding: a guardian created
-- via Core Admissions (lib/core/learnerOnboarding.ts) gets
-- learner_guardians.user_id hardcoded null with no invite/claim mechanism
-- pointing at it — that guardian can never become an authenticated parent.
--
-- The one working parent-link mechanism in this codebase, `student_invites`
-- (undocumented in any tracked migration — confirmed live via
-- information_schema.columns), is irreducibly coupled to the LEGACY
-- `students` table: its FK targets students(id) and its claim handler
-- (app/api/parent/link-student/route.ts) writes students.parent_user_id
-- directly. Per the Sprint 12 investigation
-- (docs/architecture/sprint12-release-blocker-investigation.md, Critical 1):
-- forcing Core through that table means branching the claim handler on
-- which FK is populated — more coupling than a small new table. This table
-- exists ONLY because that legacy table is FK-bound to a different schema;
-- every other aspect (token generation, expiry, claim-validation shape) is
-- copied from student_invites' own proven-live column defaults, not
-- reinvented.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS core_guardian_invites (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  learner_guardian_id uuid        NOT NULL REFERENCES learner_guardians(id) ON DELETE CASCADE,
  -- Same generation as student_invites.token (confirmed live via
  -- information_schema): 32 random bytes, hex-encoded — cryptographically
  -- unguessable, not reinvented.
  token               text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at          timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_core_guardian_invites_school_id           ON core_guardian_invites (school_id);
CREATE INDEX IF NOT EXISTS idx_core_guardian_invites_learner_guardian_id ON core_guardian_invites (learner_guardian_id);
-- token already has a UNIQUE constraint (implicit btree index) — no
-- separate index needed for the claim lookup by token.

ALTER TABLE core_guardian_invites ENABLE ROW LEVEL SECURITY;

-- Matches every other Core table's school-membership RLS shape (e.g.
-- class_subjects_school_users, learner_guardians' own policy) — school
-- staff of the invite's own school may read/manage it. The actual
-- create/claim writes go through the service-role client (server-side
-- routes/lib functions, per CLAUDE.md's rule), which bypasses RLS; this
-- policy exists for direct-client-access safety and consistency, same
-- posture as every sibling Core table.
CREATE POLICY "core_guardian_invites_school_users"
  ON core_guardian_invites FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = core_guardian_invites.school_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );
