-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 2D — Durable Learner Identity Foundation + Transfer Continuity
--
-- Implements the architecture approved (design-only) in Phase 2C. Establishes
-- `learner_identities.id` as the durable EduNexus identity that survives
-- inter-school transfer, while `learners.id` remains the school-owned
-- institutional record it always was. This migration does NOT touch
-- `students`, `learner_evidence`, or any evidence/projection table, and does
-- NOT enforce a hard 1-to-1 `UNIQUE(learner_identity_id) WHERE status='active'`
-- constraint on `learners` — Phase 2C found legitimate dual-school enrollment
-- is real; that invariant is enforced in code (lib/core/learnerIdentity.ts),
-- not the database.
--
-- Scope lock (Phase 2D spec): learner_identities, learner_identity_links,
-- learner_transfer_tokens, learners.learner_identity_id only. No
-- learner_accounts, no auth, no evidence rewrite.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. LEARNER_IDENTITIES — minimal, PII-free durable identity
--    No name/DOB/admission number/guardian info/phone/UPI here, ever. The
--    durable identity is deliberately an opaque anchor — all PII lives on
--    the school-owned `learners` row(s) that point at it.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS learner_identities (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE learner_identities ENABLE ROW LEVEL SECURITY;

-- Deliberately NO general school-staff SELECT policy. This table carries no
-- PII, but it is the join key that would let a broad read policy be used to
-- enumerate cross-school linkage, which is exactly what Phase 2C's "no
-- automatic cross-school matching" finding forbids building a shortcut
-- around. Access is via authorized domain joins/server functions
-- (service-role client, gated by lib/core/learnerIdentity.ts) only. A
-- deny-all policy is added explicitly (rather than leaving RLS enabled with
-- zero policies, which already defaults to deny) so the intent is
-- self-documenting to a future migration reader.
CREATE POLICY "learner_identities_no_direct_client_access"
  ON learner_identities FOR ALL
  USING (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. learners.learner_identity_id — nullable FK, backfilled in application
--    code (lib/core/learnerIdentity.ts backfill), not in this migration.
--    Nullable so this migration can be applied without a blocking backfill
--    transaction; Phase 2D's Step 4/5 backfill populates every existing row
--    immediately after.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE learners
  ADD COLUMN IF NOT EXISTS learner_identity_id uuid REFERENCES learner_identities(id);

CREATE INDEX IF NOT EXISTS idx_learners_learner_identity_id
  ON learners (learner_identity_id) WHERE learner_identity_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. LEARNER_IDENTITY_LINKS — audit trail, supersede-never-edit
--    Mirrors the established `learner_evidence` "corrections are new rows
--    superseding old rows, never an edit" pattern (CLAUDE.md).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS learner_identity_links (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id             uuid        NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  learner_identity_id    uuid        NOT NULL REFERENCES learner_identities(id),
  linked_by              uuid        REFERENCES school_users(id),
  linked_at              timestamptz NOT NULL DEFAULT now(),
  linkage_reason         text        NOT NULL CHECK (linkage_reason IN ('admission_default', 'transfer_token', 'admin_correction')),
  transfer_id            uuid        REFERENCES learner_transfers(id),
  superseded_at          timestamptz,
  superseded_by_link_id  uuid        REFERENCES learner_identity_links(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learner_identity_links_learner_id   ON learner_identity_links (learner_id);
CREATE INDEX IF NOT EXISTS idx_learner_identity_links_identity_id  ON learner_identity_links (learner_identity_id);
CREATE INDEX IF NOT EXISTS idx_learner_identity_links_transfer_id  ON learner_identity_links (transfer_id) WHERE transfer_id IS NOT NULL;

-- At most one CURRENT (non-superseded) link per learner — Step 2's
-- cardinality invariant, enforced as a partial unique index rather than a
-- trigger: a link row with superseded_at IS NULL is "current"; there may be
-- any number of superseded rows in history.
CREATE UNIQUE INDEX IF NOT EXISTS uq_learner_identity_links_current_per_learner
  ON learner_identity_links (learner_id) WHERE superseded_at IS NULL;

ALTER TABLE learner_identity_links ENABLE ROW LEVEL SECURITY;

-- A school user may only read link provenance for learner rows belonging to
-- their own school — joins through `learners.school_id`, matching every
-- other Core table's school-membership RLS shape.
CREATE POLICY "learner_identity_links_school_staff_own_school"
  ON learner_identity_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM learners l
      JOIN school_users su ON su.school_id = l.school_id
      WHERE l.id = learner_identity_links.learner_id
        AND su.user_id = auth.uid()
        AND su.role IN ('school_admin', 'headteacher', 'deputy_headteacher', 'teacher')
        AND su.is_active = true
    )
  );

-- Writes only through the service-role client (lib/core/learnerIdentity.ts),
-- which bypasses RLS per CLAUDE.md's server-side DB rule — no client-side
-- INSERT/UPDATE policy is added, matching the "trusted server paths only"
-- posture required for provenance integrity.

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. LEARNER_TRANSFER_TOKENS — single-use transfer-continuity handshake
--    Stores only a hash of the raw token, never the raw token itself,
--    mirroring the API-key hashing pattern already in lib/organizations/utils.ts.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS learner_transfer_tokens (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id            uuid        NOT NULL REFERENCES learner_transfers(id) ON DELETE CASCADE,
  token_hash             text        NOT NULL UNIQUE,
  expires_at             timestamptz NOT NULL,
  consumed_at            timestamptz,
  consumed_by_learner_id uuid        REFERENCES learners(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learner_transfer_tokens_transfer_id ON learner_transfer_tokens (transfer_id);
-- token_hash already has a UNIQUE constraint (implicit btree index) — no
-- separate index needed for the consume-time lookup by hash.

ALTER TABLE learner_transfer_tokens ENABLE ROW LEVEL SECURITY;

-- No general SELECT policy at all — not even scoped to the issuing school.
-- A token's `token_hash` must never be enumerable by any school-staff role
-- (Step 21); issuance and consumption go exclusively through the
-- service-role client under lib/core/transferTokens.ts / lib/core/transfers.ts,
-- which independently verify actor + school authority before ever touching
-- this table. Explicit deny-all, same rationale as learner_identities above.
CREATE POLICY "learner_transfer_tokens_no_direct_client_access"
  ON learner_transfer_tokens FOR ALL
  USING (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. updated_at triggers — reuse the existing shared trigger function if
--    present (every other Core table uses the same convention).
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    CREATE TRIGGER set_updated_at_learner_identities
      BEFORE UPDATE ON learner_identities
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    CREATE TRIGGER set_updated_at_learner_identity_links
      BEFORE UPDATE ON learner_identity_links
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    CREATE TRIGGER set_updated_at_learner_transfer_tokens
      BEFORE UPDATE ON learner_transfer_tokens
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
