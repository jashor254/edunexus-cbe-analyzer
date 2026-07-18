-- Learner Innovation domain (Sprint 13I, ADR-0018).
--
-- Phase 1 re-audit (sprint-13i doc) re-confirmed no Innovation repository,
-- service, schema, or route exists anywhere in the codebase. "Innovation"
-- exists only as a bare classification value in three sibling domains —
-- learner_achievements.achievement_type/category, learner_projects.category,
-- learner_competitions.category — none of which tracks the actual
-- evolutionary process this migration exists to own. This migration does
-- not touch any of those three tables (ADR-0018's "Achievement references
-- Innovation, going forward" is deliberately deferred to a future,
-- Achievement-domain-led migration, mirroring every prior domain's
-- identical deferral).
--
-- Lifecycle is ADR-0018 Phase 5's frozen eight-state main line — Idea,
-- Exploration, Prototype, Testing, Refinement, Validation, Implementation,
-- Archived — plus three named terminal branches: Discontinued (from Idea/
-- Exploration/Prototype/Testing/Refinement), Not Validated (a rejection
-- outcome from Refinement — see lib/learnerInnovation/innovation.ts's own
-- header for why Validated/Not-Validated are modeled as two sibling
-- outcomes of the same gate, not a linear pass-through), Revoked (from
-- Implementation). The lifecycle is strictly forward-only — repeated
-- Prototype/Testing/Refinement cycles are captured entirely in the
-- append-only `innovation_iterations` table, never by moving `status`
-- backward.
--
-- Four tables, matching the mission's own suggested names exactly:
-- learner_innovations (the lifecycle-bearing entity), innovation_iterations
-- (Problem/Hypothesis/Change/Evidence/Outcome/Teacher-note, append-only,
-- immutable from the moment of creation — mission Phase 7: "never edit
-- prior iterations, never delete them"), innovation_artifacts (link-out
-- media only, mirroring achievement_media/competition_media's identical
-- "no file bytes, no bucket" pattern), innovation_review_history (the
-- lifecycle-transition audit trail every sibling domain's own *_history
-- table already establishes).
--
-- No score, no ranking, no popularity metric, no AI field exists anywhere
-- in this schema (ADR-0018 Phase 8 Principle 9, mission Phase 2/Stop
-- Condition).

CREATE TABLE IF NOT EXISTS learner_innovations (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id                uuid        NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  school_id                 uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  -- Phase 2/4 — the domain's own defining facts.
  problem_addressed         text        NOT NULL,
  idea_summary              text        NOT NULL,

  status                    text        NOT NULL DEFAULT 'idea' CHECK (status IN (
                               'idea', 'exploration', 'prototype', 'testing', 'refinement',
                               'validation', 'implementation', 'archived',
                               'discontinued', 'not_validated', 'revoked'
                             )),

  -- Mentor guidance (ADR-0018 Phase 4) — a reference field, not a new
  -- identity system, mirroring Competition's/Leadership's identical field.
  mentor_school_user_id     uuid        REFERENCES school_users(id) ON DELETE SET NULL,

  -- ADR-0018 Phase 4/6 — Innovation may reference a Project it produced or
  -- a Competition it was entered into, one direction only. Neither table
  -- is altered by this migration.
  project_id                uuid        REFERENCES learner_projects(id) ON DELETE SET NULL,
  competition_id            uuid        REFERENCES learner_competitions(id) ON DELETE SET NULL,

  -- Validation phase output — teacher-gated (mission Phase 8: "Validation
  -- requires teacher approval").
  validated_by              uuid        REFERENCES school_users(id) ON DELETE SET NULL,
  validated_at              timestamptz,

  -- Implementation phase output (ADR-0018 Phase 4: "Adoption... a recorded
  -- fact at the Implementation phase, never inferred").
  impact_evidence           text,
  adoption_note             text,
  public_demonstration      text,

  -- Terminal-branch facts.
  discontinued_reason       text,
  -- Mission/ADR-0018 Phase 8 Principle 2 — Discontinued requires not just
  -- a reason but what was learned; failure is preserved as evidence, never
  -- silently dropped.
  lessons_learned           text,
  discontinued_at           timestamptz,
  not_validated_reason      text,
  not_validated_at          timestamptz,
  revoked_by                uuid        REFERENCES school_users(id) ON DELETE SET NULL,
  revoked_reason            text,
  revoked_at                timestamptz,

  archived_at               timestamptz,
  -- Named `published_at`, not `implemented_at`, to match every sibling
  -- domain's required-field naming convention (mission Phase 2) even
  -- though ADR-0018 deliberately has no separate "Published" status —
  -- this column is set at the moment `status` becomes 'implementation',
  -- which is this domain's own credential-worthy state (ADR-0018 Phase 5:
  -- "the equivalent of every sibling domain's Published").
  published_at              timestamptz,

  -- Reference-not-copy, mirroring every sibling domain's own
  -- supporting_evidence_ids pattern (ADR-0018 Phase 4/7).
  supporting_evidence_ids   uuid[]      NOT NULL DEFAULT '{}',

  -- Attribution only (CLAUDE.md: never an access gate).
  recorded_by               uuid        REFERENCES school_users(id) ON DELETE SET NULL,

  -- Lifecycle-transition counter, correlates with innovation_review_history
  -- rows (mirrors every sibling domain's `version`).
  version                   int         NOT NULL DEFAULT 1,
  -- Row-shape version, independent of `version` above — increments only if
  -- this table's own schema evolves, never per lifecycle transition
  -- (mission Phase 2's explicit "schema_version" requirement).
  schema_version             int         NOT NULL DEFAULT 1,

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learner_innovations_learner_id ON learner_innovations (learner_id, status);
CREATE INDEX IF NOT EXISTS idx_learner_innovations_school_id  ON learner_innovations (school_id);
CREATE INDEX IF NOT EXISTS idx_learner_innovations_project_id ON learner_innovations (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_learner_innovations_competition_id ON learner_innovations (competition_id) WHERE competition_id IS NOT NULL;

-- The domain's unique architectural feature (mission Phase 7). Structured,
-- not a generic freeform media dump (ADR-0018 Phase 10's own "upload
-- folder" risk protection) — every row is a real evolutionary step:
-- Problem, Hypothesis, Change introduced, Evidence, Outcome, an optional
-- Teacher note, and a timestamp. Never edited, never deleted, from the
-- moment of creation, regardless of the parent innovation's status
-- (mission Phase 7: "Never edit prior iterations. Never delete them.").
CREATE TABLE IF NOT EXISTS innovation_iterations (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  innovation_id         uuid        NOT NULL REFERENCES learner_innovations(id) ON DELETE CASCADE,
  problem               text        NOT NULL,
  hypothesis            text        NOT NULL,
  change_introduced     text        NOT NULL,
  evidence              text        NOT NULL,
  outcome               text        NOT NULL,
  teacher_note          text,
  actor_school_user_id  uuid        REFERENCES school_users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_innovation_iterations_innovation_id ON innovation_iterations (innovation_id, created_at);

-- Link-out media only — no file bytes, no bucket, no upload path (Stop
-- Condition), mirroring achievement_media/competition_media exactly.
CREATE TABLE IF NOT EXISTS innovation_artifacts (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  innovation_id     uuid        NOT NULL REFERENCES learner_innovations(id) ON DELETE CASCADE,
  url               text        NOT NULL,
  label             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_innovation_artifacts_innovation_id ON innovation_artifacts (innovation_id);

-- Append-only lifecycle-transition audit trail, matching
-- leadership_history/competition_history's own precedent exactly.
CREATE TABLE IF NOT EXISTS innovation_review_history (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  innovation_id         uuid        NOT NULL REFERENCES learner_innovations(id) ON DELETE CASCADE,
  from_status           text        NOT NULL,
  to_status             text        NOT NULL,
  actor_school_user_id  uuid        REFERENCES school_users(id) ON DELETE SET NULL,
  reason                text,
  version               int         NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_innovation_review_history_innovation_id ON innovation_review_history (innovation_id, version);

ALTER TABLE learner_innovations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE innovation_iterations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE innovation_artifacts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE innovation_review_history ENABLE ROW LEVEL SECURITY;

-- School-isolation only, matching every sibling domain's convention
-- EXCEPT Wellbeing (ADR-0017's deliberate Support-Team-scoped departure
-- does not apply here — Innovation is a showcase-type domain, not
-- confidential, per ADR-0018 Phase 6). No write policy for the
-- `authenticated` role — every write goes through the service-role client.
CREATE POLICY "learner_innovations_school_staff_read"
  ON learner_innovations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = learner_innovations.school_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

CREATE POLICY "innovation_iterations_school_staff_read"
  ON innovation_iterations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM learner_innovations li
      JOIN school_users su ON su.school_id = li.school_id
      WHERE li.id = innovation_iterations.innovation_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

CREATE POLICY "innovation_artifacts_school_staff_read"
  ON innovation_artifacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM learner_innovations li
      JOIN school_users su ON su.school_id = li.school_id
      WHERE li.id = innovation_artifacts.innovation_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

CREATE POLICY "innovation_review_history_school_staff_read"
  ON innovation_review_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM learner_innovations li
      JOIN school_users su ON su.school_id = li.school_id
      WHERE li.id = innovation_review_history.innovation_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

-- Immutability (ADR-0018 Phase 5/8/10, mission Phase 8 — same three-layer
-- discipline as every prior domain: Service, Repository, DB trigger, all
-- three, proven against raw DB access). `discontinued`/`not_validated`/
-- `revoked`/`archived` are fully terminal. `implementation` allows exactly
-- two further transitions — to `archived` or to `revoked` — with every
-- other field frozen. No delete path exists once an innovation has left
-- `idea`.
CREATE OR REPLACE FUNCTION enforce_innovation_immutability() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status != 'idea' THEN
      RAISE EXCEPTION 'learner_innovations row % has left idea (status=%) and can never be deleted (Sprint 13I, ADR-0018).', OLD.id, OLD.status;
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status IN ('discontinued', 'not_validated', 'revoked', 'archived') THEN
    RAISE EXCEPTION 'learner_innovations row % is % and permanently immutable (Sprint 13I, ADR-0018) — Archived cannot reopen.', OLD.id, OLD.status;
  END IF;

  IF OLD.status = 'implementation' THEN
    IF NEW.status IN ('archived', 'revoked')
       AND NEW.id = OLD.id AND NEW.learner_id = OLD.learner_id AND NEW.school_id = OLD.school_id
       AND NEW.problem_addressed = OLD.problem_addressed AND NEW.idea_summary = OLD.idea_summary
       AND NEW.mentor_school_user_id IS NOT DISTINCT FROM OLD.mentor_school_user_id
       AND NEW.project_id IS NOT DISTINCT FROM OLD.project_id AND NEW.competition_id IS NOT DISTINCT FROM OLD.competition_id
       AND NEW.validated_by IS NOT DISTINCT FROM OLD.validated_by AND NEW.validated_at IS NOT DISTINCT FROM OLD.validated_at
       AND NEW.impact_evidence IS NOT DISTINCT FROM OLD.impact_evidence
       AND NEW.adoption_note IS NOT DISTINCT FROM OLD.adoption_note
       AND NEW.public_demonstration IS NOT DISTINCT FROM OLD.public_demonstration
       AND NEW.supporting_evidence_ids = OLD.supporting_evidence_ids
       AND NEW.recorded_by IS NOT DISTINCT FROM OLD.recorded_by
       AND NEW.published_at IS NOT DISTINCT FROM OLD.published_at
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'learner_innovations row % is implemented and immutable except moving to archived/revoked (Sprint 13I, ADR-0018).', OLD.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_learner_innovations_immutability_update
  BEFORE UPDATE ON learner_innovations
  FOR EACH ROW EXECUTE FUNCTION enforce_innovation_immutability();

CREATE TRIGGER trg_learner_innovations_immutability_delete
  BEFORE DELETE ON learner_innovations
  FOR EACH ROW EXECUTE FUNCTION enforce_innovation_immutability();

-- Iterations and review history are append-only, unconditionally, from
-- the moment they are written (mission Phase 7/8).
CREATE OR REPLACE FUNCTION reject_innovation_iteration_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'innovation_iterations is append-only and can never be updated or deleted (Sprint 13I, ADR-0018).';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_innovation_iterations_no_update
  BEFORE UPDATE ON innovation_iterations
  FOR EACH ROW EXECUTE FUNCTION reject_innovation_iteration_mutation();

CREATE TRIGGER trg_innovation_iterations_no_delete
  BEFORE DELETE ON innovation_iterations
  FOR EACH ROW EXECUTE FUNCTION reject_innovation_iteration_mutation();

CREATE OR REPLACE FUNCTION reject_innovation_review_history_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'innovation_review_history is append-only and can never be updated or deleted (Sprint 13I, ADR-0018).';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_innovation_review_history_no_update
  BEFORE UPDATE ON innovation_review_history
  FOR EACH ROW EXECUTE FUNCTION reject_innovation_review_history_mutation();

CREATE TRIGGER trg_innovation_review_history_no_delete
  BEFORE DELETE ON innovation_review_history
  FOR EACH ROW EXECUTE FUNCTION reject_innovation_review_history_mutation();

CREATE OR REPLACE FUNCTION set_learner_innovations_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_learner_innovations_updated_at
  BEFORE UPDATE ON learner_innovations
  FOR EACH ROW EXECUTE FUNCTION set_learner_innovations_updated_at();
