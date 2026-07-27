-- ─────────────────────────────────────────────────────────────────────────────
-- BLUEPRINT ACTION REVIEW — Phase 2D of
-- docs/architecture/blueprint-living-action-plan-audit.md, per
-- docs/architecture/blueprint-review-loop-phase2d.md and
-- docs/architecture/adr-0031-educational-actions-require-human-review.md.
--
-- Teacher Review is the final stage of the Blueprint execution cycle:
--   Evidence -> Projection -> Blueprint -> Teacher Approval -> Blueprint
--   Action -> Delivery -> Learner Interaction -> New Evidence -> Teacher
--   Review.
--
-- A new, dedicated, append-only table — not a column on
-- `blueprint_action_items` — for two independent reasons, mirroring and
-- extending Phase 2C's identical choice for `blueprint_compass_deliveries`:
--
--  1. `blueprint_action_items` is structurally frozen once decided.
--     `enforce_blueprint_action_item_decision_immutability` (Phase 1)
--     rejects ANY update once `status IN ('approved','rejected')` — and
--     `approved` is the only status a delivered, reviewable item can have.
--     Writing a review verdict onto that row is not merely inconsistent
--     with the Phase 2B/2C precedent of "delivery is an event, not a
--     status mutation" — it is currently impossible without weakening a
--     guarantee the other two phases depend on. This migration does not
--     touch that trigger.
--
--  2. A review is repeatable, not a one-time transition. A teacher may
--     review the same action item more than once over its life (after
--     further Compass sessions, after a resubmission, after a "Reopen"
--     sends the learner back to work). `blueprint_action_reviews` therefore
--     has NO uniqueness constraint on `blueprint_action_item_id` — unlike
--     `blueprint_compass_deliveries`, every review is a new, immutable row;
--     "the latest review" is a query (`ORDER BY created_at DESC LIMIT 1`),
--     never an update to a prior one.
--
-- Immutability is enforced at the database level (not just convention),
-- matching `blueprint_action_item_history`'s own precedent exactly: once
-- inserted, a review row can never be updated or deleted by anyone,
-- including a service-role caller.
--
-- Ownership: written exclusively by
-- lib/learnerBlueprint/actionPlan/review.ts via
-- lib/repositories/blueprintActionReview.repository.ts — no other module
-- may write to this table.
--
-- This migration writes no Evidence, no Projection, no Assignment, no
-- Compass row — Teacher Review only ever reads those systems. See the
-- Phase 2D doc's guardrail sections for the full boundary.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS blueprint_action_reviews (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core learner identity, matching blueprint_action_items' own convention
  -- — copied at review time for query convenience, never the source of
  -- truth (the action item itself is).
  learner_id                uuid        NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  school_id                 uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  -- No UNIQUE constraint here on purpose — see header, reason 2.
  blueprint_action_item_id  uuid        NOT NULL REFERENCES blueprint_action_items(id) ON DELETE CASCADE,

  -- Exactly five outcomes. No automatic-success value exists — every
  -- decision here is a teacher's own recorded professional judgement, not
  -- something software could reach on its own.
  decision                  text        NOT NULL
                              CHECK (decision IN ('complete','needs_revision','reopen','defer','no_decision')),
  notes                     text,

  -- Read-only snapshots of what the review service observed at the moment
  -- of this review — never a second copy of the source of truth, only a
  -- durable record of what was shown to the teacher when they made this
  -- judgement (Evidence/Projection continue to change after review; this
  -- is what justified the judgement, not a live mirror of either system).
  assignment_snapshot        jsonb,
  compass_snapshot           jsonb,
  evidence_snapshot          jsonb,
  projection_snapshot        jsonb,

  reviewed_by                uuid        REFERENCES school_users(id) ON DELETE SET NULL,

  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blueprint_action_reviews_action_item_id ON blueprint_action_reviews (blueprint_action_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blueprint_action_reviews_learner_id     ON blueprint_action_reviews (learner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blueprint_action_reviews_school_id      ON blueprint_action_reviews (school_id);

ALTER TABLE blueprint_action_reviews ENABLE ROW LEVEL SECURITY;

-- Same coarse school-isolation + staff-only role filter as
-- blueprint_action_items/blueprint_compass_deliveries — fine-grained "does
-- this teacher actually manage this learner" enforcement happens at the
-- application layer (canManageLearnerRecordCore), not here.
CREATE POLICY "blueprint_action_reviews_school_staff_read"
  ON blueprint_action_reviews FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = blueprint_action_reviews.school_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
        AND su.role IN ('school_admin', 'headteacher', 'deputy_headteacher', 'teacher')
    )
  );

-- No INSERT/UPDATE/DELETE policy for `authenticated` — service-role only,
-- written exclusively by reviewBlueprintAction() (see header).

-- Append-only, unconditionally — mirrors
-- enforce_blueprint_action_item_history_immutability exactly. "Never
-- overwrite previous review decisions" is enforced here, not left as a
-- convention the application layer could violate by mistake.
CREATE OR REPLACE FUNCTION enforce_blueprint_action_reviews_immutability() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'blueprint_action_reviews row % is immutable — a review is never edited or deleted, only superseded by a new review row.',
    COALESCE(OLD.id, NULL);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_blueprint_action_reviews_no_update
  BEFORE UPDATE ON blueprint_action_reviews
  FOR EACH ROW EXECUTE FUNCTION enforce_blueprint_action_reviews_immutability();

CREATE TRIGGER trg_blueprint_action_reviews_no_delete
  BEFORE DELETE ON blueprint_action_reviews
  FOR EACH ROW EXECUTE FUNCTION enforce_blueprint_action_reviews_immutability();


-- ─────────────────────────────────────────────────────────────────────────────
-- Widen `blueprint_action_item_history.event_type` again to admit the five
-- review events alongside Phase 1's set and Phase 2B/2C's 'delivered' /
-- 'delivered_to_compass' — purely additive, every previously-valid value
-- stays valid. One event type per review decision, a clean 1:1 mapping
-- (deliberately not using a separate "review_started" event — see the
-- Phase 2D doc for why: reviewBlueprintAction() is a single atomic
-- operation, never a two-step "open then decide" flow, so there is no
-- distinct moment for a "started" event to represent).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE blueprint_action_item_history
  DROP CONSTRAINT IF EXISTS blueprint_action_item_history_event_type_check;

ALTER TABLE blueprint_action_item_history
  ADD CONSTRAINT blueprint_action_item_history_event_type_check
  CHECK (event_type IN (
    'proposed','edited','approved','rejected','deferred',
    'delivered','delivered_to_compass',
    'review_completed','review_revision_requested','review_reopened','review_deferred','review_no_decision'
  ));

COMMENT ON COLUMN blueprint_action_item_history.event_type IS
  'proposed/edited/approved/rejected/deferred (Phase 1), delivered (Phase 2B - assignment), delivered_to_compass (Phase 2C - Compass objective), review_completed/review_revision_requested/review_reopened/review_deferred/review_no_decision (Phase 2D - teacher review). None of these change the action item''s own status, which remains approved after delivery or review.';
