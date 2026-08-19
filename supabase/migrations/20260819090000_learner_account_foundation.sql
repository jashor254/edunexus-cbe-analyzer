-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 2B-RESUME — Institutional Learner Account Foundation
--
-- Establishes authenticated learner identity on top of Phase 2D's durable
-- identity anchor (supabase/migrations/20260818180000_learner_durable_identity.sql).
-- Canonical chain: auth.users.id -> learner_accounts -> learner_identities.id
-- -> current authorized learners.id -> learner_enrollments. NOT
-- auth.users -> learners.id directly (Phase 2A's original binding, corrected
-- by Phase 2D's finding that learners.id does not survive transfer).
--
-- Scope lock (Phase 2B-RESUME spec Step 25): learner_accounts,
-- learner_account_invites, constraints, indexes, RLS only. Does not alter
-- learners, learner_identities, learner_transfer_tokens, students,
-- learner_enrollments, or any evidence table. Applied to disposable LOCAL
-- Docker Supabase only — never production.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. LEARNER_ACCOUNTS — one durable identity <-> zero or one auth user
--
--    Deliberately does NOT carry: school_id (the account belongs to the
--    durable identity, not a school — Step 2), current learners.id
--    (school-local resolution is a separate, explicit lookup — Step 13/14),
--    activation token, password, or admission number.
--
--    Status is deliberately just 'active'/'suspended' (Step 4) — there is
--    no 'pending' here: no row exists at all until a claim succeeds, and a
--    successful claim creates the row already ACTIVE. Pending-ness lives
--    entirely in learner_account_invites below.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS learner_accounts (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_identity_id uuid        NOT NULL REFERENCES learner_identities(id),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status              text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  activated_at        timestamptz NOT NULL DEFAULT now(),
  suspended_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  -- Step 3 cardinality: one durable identity -> at most one account row;
  -- one auth user -> at most one account row. A second activation attempt
  -- for an already-bound identity or user must be rejected in code before
  -- reaching this constraint (Step 16's "already_active" response), but the
  -- constraint is the backstop of record, not the only line of defense.
  CONSTRAINT uq_learner_accounts_learner_identity_id UNIQUE (learner_identity_id),
  CONSTRAINT uq_learner_accounts_user_id UNIQUE (user_id),
  CONSTRAINT ck_learner_accounts_suspended_at CHECK (
    (status = 'suspended' AND suspended_at IS NOT NULL) OR
    (status = 'active' AND suspended_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_learner_accounts_learner_identity_id ON learner_accounts (learner_identity_id);
CREATE INDEX IF NOT EXISTS idx_learner_accounts_user_id ON learner_accounts (user_id);

ALTER TABLE learner_accounts ENABLE ROW LEVEL SECURITY;

-- Self SELECT only (Step 23) — a learner may read their own account status.
-- No general school-staff SELECT: the account is not school-owned, and a
-- school reading it directly would let School A observe whether a learner
-- who left is active at School B, which is exactly the cross-school
-- authority leak Step 19 (suspension) and Step 14 (multi-school) rule out.
CREATE POLICY "learner_accounts_self_select"
  ON learner_accounts FOR SELECT
  USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE policy for any client role — every mutation goes
-- through lib/core/learnerAccounts.ts's service-role client (claim,
-- suspend), matching learner_identities/learner_transfer_tokens' posture
-- from Phase 2D.

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. LEARNER_ACCOUNT_INVITES — ephemeral school-issued activation
--    authorization. Only a hash of the raw activation token is ever stored
--    (Step 5, Step 24) — mirrors learner_transfer_tokens exactly.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS learner_account_invites (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_identity_id uuid        NOT NULL REFERENCES learner_identities(id),
  school_id           uuid        NOT NULL REFERENCES schools(id),
  token_hash          text        NOT NULL UNIQUE,
  purpose             text        NOT NULL DEFAULT 'activation' CHECK (purpose IN ('activation', 'recovery')),
  expires_at          timestamptz NOT NULL,
  used_at             timestamptz,
  issued_by           uuid        REFERENCES school_users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learner_account_invites_learner_identity_id ON learner_account_invites (learner_identity_id);
CREATE INDEX IF NOT EXISTS idx_learner_account_invites_school_id ON learner_account_invites (school_id);
-- token_hash already has a UNIQUE constraint (implicit btree index) — no
-- separate lookup index needed.

ALTER TABLE learner_account_invites ENABLE ROW LEVEL SECURITY;

-- Deny-all, same rationale as learner_transfer_tokens (Phase 2D): the raw
-- activation token must never be enumerable, and token_hash itself must
-- never be exposed to any client role either. The issuing admin receives
-- the raw token ONLY as the direct return value of the issuance call
-- (lib/core/learnerAccounts.ts::issueLearnerAccountActivation), never via a
-- SELECT against this table. Issuance and claim both go exclusively
-- through the service-role client, which independently verifies actor +
-- school authority (Step 6) before ever touching this table.
CREATE POLICY "learner_account_invites_no_direct_client_access"
  ON learner_account_invites FOR ALL
  USING (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. updated_at triggers — reuse the existing shared trigger function if
--    present (every other Core table uses the same convention).
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    CREATE TRIGGER set_updated_at_learner_accounts
      BEFORE UPDATE ON learner_accounts
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    CREATE TRIGGER set_updated_at_learner_account_invites
      BEFORE UPDATE ON learner_account_invites
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
