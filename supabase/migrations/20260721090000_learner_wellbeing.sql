-- Learner Wellbeing domain (Sprint 13G, ADR-0017).
--
-- Phase 1 re-audit (sprint-13g doc) re-confirmed no Wellbeing repository,
-- service, schema, or route exists anywhere in the codebase — zero hits
-- for "wellbeing" in any spelling. This migration implements ONLY what
-- ADR-0017 froze: no counselling module, no diagnosis field, no score, no
-- risk field, no AI hook of any kind.
--
-- Three tables, not two, deliberately: ADR-0017 Phase 3 named
-- "Support Team" as its own owned concept and mission Phase 6 mandates a
-- Support-Team-scoped security model (not the blanket school-staff-read
-- RLS every sibling domain uses) — that requires a real membership table,
-- `wellbeing_support_team`, beyond the two names the mission suggested.
-- This is a necessary consequence of Phase 6's own security mandate, not
-- a speculative extra.
--
-- Lifecycle is ADR-0017 Phase 5's frozen six-state main line — Concern
-- Raised, Initial Assessment, Support Plan Active, Review, Outcome
-- Recorded, Closed — plus two named terminal branches: No Action Needed
-- (Initial Assessment -> No Action Needed), Withdrawn (Support Plan
-- Active/Review -> Withdrawn). There is NO Verification state and NO
-- Published state (ADR-0017 Phase 5's central, deliberate departure from
-- every sibling domain) — Wellbeing produces no external, showcaseable
-- claim, so Outcome Recorded -> Closed is a direct transition with no
-- automatic queueing step.
--
-- Escalation Status (ADR-0017 Phase 5) is a field independent of the main
-- lifecycle, not a status value.
--
-- Visibility Classification (ADR-0017 Phase 8) is a closed two-tier model
-- — 'core_team' (strictest) and 'school_leadership' (looser, still never
-- "any school staff") — enforced by RLS below, never a free-for-all.
--
-- No AI, no score, no risk field, no diagnosis field exists anywhere in
-- this schema (ADR-0017 Phase 4/9, Stop Condition).

CREATE TABLE IF NOT EXISTS learner_wellbeing_cases (
  id                              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id                      uuid        NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  school_id                       uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  -- ADR-0017 Phase 3 — deliberate two-tier model: not every concern
  -- warrants a formal plan.
  case_type                       text        NOT NULL CHECK (case_type IN ('check_in', 'support_plan')),

  -- Factual description of the concern raised — never diagnostic language
  -- (enforced editorially, mirroring Teacher Reflection's identical
  -- discipline, ADR-0006 §6; automated validation can only check presence
  -- and length, see lib/learnerWellbeing/reflection.ts's own header for
  -- the same honest limitation Teacher Reflection already documents).
  concern_summary                 text        NOT NULL,

  status                          text        NOT NULL DEFAULT 'concern_raised' CHECK (status IN (
                                     'concern_raised', 'initial_assessment', 'support_plan_active',
                                     'review', 'outcome_recorded', 'closed',
                                     'no_action_needed', 'withdrawn'
                                   )),

  -- Escalation Status — independent of the main lifecycle (ADR-0017 Phase 5).
  escalation_status                text        NOT NULL DEFAULT 'not_escalated' CHECK (escalation_status IN (
                                     'not_escalated', 'escalated_school_leadership', 'escalated_external_authority'
                                   )),
  escalated_by                    uuid        REFERENCES school_users(id) ON DELETE SET NULL,
  escalated_at                    timestamptz,

  -- Phase-owned facts, recorded once at their own lifecycle phase.
  support_goal                    text,
  support_outcome                 text,
  outcome_recorded_at             timestamptz,
  no_action_reason                text,
  withdrawn_reason                text,
  withdrawn_at                    timestamptz,
  closed_at                       timestamptz,

  -- The case's own default Visibility Classification (ADR-0017 Phase 8) —
  -- an individual update may only override to something equal-or-stricter
  -- than this, never looser (enforced in lib/learnerWellbeing/, not just
  -- documented — see validateVisibilityOverride).
  default_visibility_classification text      NOT NULL DEFAULT 'core_team'
                                     CHECK (default_visibility_classification IN ('core_team', 'school_leadership')),

  -- Attribution only (CLAUDE.md: never an access gate — access is
  -- wellbeing_support_team membership only, see RLS below).
  raised_by                       uuid        REFERENCES school_users(id) ON DELETE SET NULL,
  assessed_by                     uuid        REFERENCES school_users(id) ON DELETE SET NULL,

  version                         int         NOT NULL DEFAULT 1,

  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learner_wellbeing_cases_learner_id ON learner_wellbeing_cases (learner_id, status);
CREATE INDEX IF NOT EXISTS idx_learner_wellbeing_cases_school_id  ON learner_wellbeing_cases (school_id);

-- The access-control unit itself (ADR-0017 Phase 3/8, mission Phase 6) —
-- named individuals authorized on a specific case. No blanket
-- school-staff read exists anywhere in this domain; this table IS the
-- authorization boundary.
CREATE TABLE IF NOT EXISTS wellbeing_support_team (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id           uuid        NOT NULL REFERENCES learner_wellbeing_cases(id) ON DELETE CASCADE,
  school_user_id    uuid        NOT NULL REFERENCES school_users(id) ON DELETE CASCADE,
  -- 'core_team' (full access, including 'core_team'-classified updates) or
  -- 'school_leadership' (access to the case and 'school_leadership'-
  -- classified updates only, never 'core_team'-classified ones).
  role              text        NOT NULL DEFAULT 'core_team' CHECK (role IN ('core_team', 'school_leadership')),
  added_by          uuid        REFERENCES school_users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (case_id, school_user_id)
);

CREATE INDEX IF NOT EXISTS idx_wellbeing_support_team_case_id ON wellbeing_support_team (case_id);
CREATE INDEX IF NOT EXISTS idx_wellbeing_support_team_school_user_id ON wellbeing_support_team (school_user_id);

-- Append-only stream combining both this domain's lifecycle-transition
-- audit trail (every sibling domain's own *_history discipline) and its
-- qualitative content (Support Review, Support Conversation, External
-- Referral, Confidential Notes) — unified deliberately, per the mission's
-- own two-table naming hint, rather than a fourth table. Never file bytes,
-- never a second copy of any other domain's data (ADR-0017 Phase 4/7).
CREATE TABLE IF NOT EXISTS learner_wellbeing_updates (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                  uuid        NOT NULL REFERENCES learner_wellbeing_cases(id) ON DELETE CASCADE,

  update_type              text        NOT NULL CHECK (update_type IN (
                              'status_change', 'escalation_change', 'review', 'conversation', 'referral', 'note'
                            )),

  -- Only set for update_type = 'status_change'.
  from_status               text,
  to_status                 text,

  -- The content itself — a review note, a logged conversation summary, a
  -- referral record (who/where/when, never the outside party's own
  -- clinical content — ADR-0017 Phase 4), or a confidential note.
  content                   text,

  -- Null means "inherit the case's own default_visibility_classification."
  -- When set, must be equal-or-stricter than the case default — enforced
  -- in the service layer (ADR-0017 Phase 8: "visibility only ever
  -- tightens, never loosens").
  visibility_classification text        CHECK (visibility_classification IN ('core_team', 'school_leadership')),

  actor_school_user_id      uuid        REFERENCES school_users(id) ON DELETE SET NULL,
  version                   int,

  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learner_wellbeing_updates_case_id ON learner_wellbeing_updates (case_id, created_at);

ALTER TABLE learner_wellbeing_cases   ENABLE ROW LEVEL SECURITY;
ALTER TABLE wellbeing_support_team    ENABLE ROW LEVEL SECURITY;
ALTER TABLE learner_wellbeing_updates ENABLE ROW LEVEL SECURITY;

-- ── RLS: Support-Team-scoped access, NOT school-staff-wide access ──────────
-- The single largest departure from every sibling domain in this series
-- (ADR-0017 Phase 8, mission Phase 6). No policy anywhere in this
-- migration grants access merely by school membership.

CREATE POLICY "learner_wellbeing_cases_support_team_read"
  ON learner_wellbeing_cases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM wellbeing_support_team wst
      JOIN school_users su ON su.id = wst.school_user_id
      WHERE wst.case_id = learner_wellbeing_cases.id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

CREATE POLICY "wellbeing_support_team_member_read"
  ON wellbeing_support_team FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM wellbeing_support_team self
      JOIN school_users su ON su.id = self.school_user_id
      WHERE self.case_id = wellbeing_support_team.case_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

-- Two-tier read: a 'school_leadership'-classified (or unclassified,
-- inheriting a 'school_leadership' case default) update is readable by
-- any support-team member; a 'core_team'-classified (or unclassified,
-- inheriting a 'core_team' case default) update is readable only by
-- support-team members whose own role is 'core_team'.
CREATE POLICY "learner_wellbeing_updates_support_team_read"
  ON learner_wellbeing_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM wellbeing_support_team wst
      JOIN school_users su ON su.id = wst.school_user_id
      JOIN learner_wellbeing_cases lwc ON lwc.id = learner_wellbeing_updates.case_id
      WHERE wst.case_id = learner_wellbeing_updates.case_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
        AND (
          COALESCE(learner_wellbeing_updates.visibility_classification, lwc.default_visibility_classification) = 'school_leadership'
          OR wst.role = 'core_team'
        )
    )
  );

-- No write policy for the `authenticated` role on any of the three tables
-- — every write goes through the service-role client, matching every
-- sibling domain's convention exactly.

-- Immutability (ADR-0017 Phase 6/8/11, mission Phase 10 — same three-layer
-- discipline as Portfolio/Achievement/Projects/Competitions/Leadership/
-- Community Service: Service, Repository, DB trigger, all three, proven
-- against raw DB access, even under the service-role client). `closed`,
-- `no_action_needed`, and `withdrawn` are all fully terminal and
-- immutable — there is no `published` state to allow a narrow further
-- transition the way every sibling domain's trigger does, because there
-- is nothing past Closed (ADR-0017 Phase 5). No delete path exists once a
-- case has left `concern_raised`.
CREATE OR REPLACE FUNCTION enforce_wellbeing_case_immutability() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status != 'concern_raised' THEN
      RAISE EXCEPTION 'learner_wellbeing_cases row % has left concern_raised (status=%) and can never be deleted (Sprint 13G, ADR-0017).', OLD.id, OLD.status;
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status IN ('closed', 'no_action_needed', 'withdrawn') THEN
    RAISE EXCEPTION 'learner_wellbeing_cases row % is % and permanently immutable (Sprint 13G, ADR-0017) — Wellbeing has no state past this one.', OLD.id, OLD.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_learner_wellbeing_cases_immutability_update
  BEFORE UPDATE ON learner_wellbeing_cases
  FOR EACH ROW EXECUTE FUNCTION enforce_wellbeing_case_immutability();

CREATE TRIGGER trg_learner_wellbeing_cases_immutability_delete
  BEFORE DELETE ON learner_wellbeing_cases
  FOR EACH ROW EXECUTE FUNCTION enforce_wellbeing_case_immutability();

-- Updates are append-only, unconditionally, from the moment they are
-- written — never edited or deleted, regardless of the parent case's
-- status (ADR-0017 Phase 3: "Confidential Notes... never silently
-- edited" — an information-integrity guarantee, not merely an
-- access-control one).
CREATE OR REPLACE FUNCTION reject_wellbeing_update_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'learner_wellbeing_updates is append-only and can never be updated or deleted (Sprint 13G, ADR-0017).';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_learner_wellbeing_updates_no_update
  BEFORE UPDATE ON learner_wellbeing_updates
  FOR EACH ROW EXECUTE FUNCTION reject_wellbeing_update_mutation();

CREATE TRIGGER trg_learner_wellbeing_updates_no_delete
  BEFORE DELETE ON learner_wellbeing_updates
  FOR EACH ROW EXECUTE FUNCTION reject_wellbeing_update_mutation();

CREATE OR REPLACE FUNCTION set_learner_wellbeing_cases_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_learner_wellbeing_cases_updated_at
  BEFORE UPDATE ON learner_wellbeing_cases
  FOR EACH ROW EXECUTE FUNCTION set_learner_wellbeing_cases_updated_at();
