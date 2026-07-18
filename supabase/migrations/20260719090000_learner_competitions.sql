-- Learner Competitions domain (Sprint 13B, ADR-0014).
--
-- Phase 1 re-audit (sprint-13b doc) re-confirmed no competition repository,
-- service, schema, or route exists anywhere in the codebase. The one real,
-- partial prior implementation is `learner_achievements.achievement_type =
-- 'competition'` (ADR-0012) — a flat, after-the-fact claim with no team,
-- mentor, judges, registration, or preparation timeline. This migration
-- does not touch `learner_achievements` at all (ADR-0014's "Achievement
-- references Competition, going forward" is deliberately deferred to a
-- future, Achievement-domain-led migration — see the sprint doc's Known
-- Gaps; this sprint's own mission forbids modifying Achievement's schema
-- or lifecycle).
--
-- "Competition" and "Competition Entry" are the same stored row for v1
-- (ADR-0014 Phase 3) — no separate Event catalog exists; the event's own
-- descriptive facts (name, organizing body, level, category, date, venue)
-- are inline fields on this one table.
--
-- Lifecycle is ADR-0014 Phase 4's frozen nine-state main line — Opportunity,
-- Registration, Preparation, Participation, Judging, Results, Verification,
-- Published, Historical — plus three named terminal branches: Rejected
-- (Verification -> Rejected), Withdrawn (Registration/Preparation/
-- Participation -> Withdrawn), Revoked (Published -> Revoked). "Results"
-- and "Verification" are both real, distinct, queryable statuses (ADR-0014
-- Phase 4 explicitly rejected merging them) — the automatic Results ->
-- Verification transition is recorded as its own history row even though
-- no human actor performs it.
--
-- Mentor is a single reference field (ADR-0014 Phase 3: "not a new identity
-- system, not a new role type") — no separate competition_mentors table,
-- deliberately, matching the mission's "do not invent additional tables"
-- instruction: Position/Results/Judges/Feedback are likewise columns, not
-- satellite tables, since each is a single fact per Competition Entry, not
-- a list.
--
-- No upload/storage system is introduced here (Stop Condition) —
-- `competition_media` (which also holds certificates, ADR-0014 Phase 3)
-- stores external link-out URLs only, never file bytes.

CREATE TABLE IF NOT EXISTS learner_competitions (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id                uuid        NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  school_id                 uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  -- Phase 2/3 — the event's own descriptive facts, inline (no Event catalog).
  name                      text        NOT NULL,
  organizing_body           text,
  level                     text        NOT NULL CHECK (level IN (
                               'school', 'regional', 'national', 'international'
                             )),
  -- The competition's own subject/domain taxonomy — deliberately separate
  -- from learner_achievements.category (ADR-0014 Phase 3: "never merged or
  -- aliased").
  category                  text        NOT NULL CHECK (category IN (
                               'academic', 'robotics', 'coding', 'debate', 'sports',
                               'music', 'drama', 'science', 'innovation', 'quiz', 'other'
                             )),
  event_date                date,
  venue                     text,

  -- ADR-0014 Phase 5 — Competition Entry may reference a Project, one
  -- direction only. Never touches learner_projects' own table or code.
  project_id                uuid        REFERENCES learner_projects(id) ON DELETE SET NULL,

  mentor_school_user_id     uuid        REFERENCES school_users(id) ON DELETE SET NULL,

  status                    text        NOT NULL DEFAULT 'opportunity' CHECK (status IN (
                               'opportunity', 'registration', 'preparation', 'participation',
                               'judging', 'results', 'verification', 'published', 'historical',
                               'rejected', 'withdrawn', 'revoked'
                             )),

  -- Results/Judging phase output (ADR-0014 Phase 3) — recorded fact, never
  -- computed by this domain or any consumer.
  position                  text,
  results_summary           text,
  judges                    text,
  feedback                  text,

  -- Reference-not-copy, mirroring learner_achievements'/learner_projects'
  -- own supporting_evidence_ids pattern (ADR-0014 Phase 3).
  supporting_evidence_ids   uuid[]      NOT NULL DEFAULT '{}',

  -- Attribution only (CLAUDE.md: never an access gate).
  recorded_by               uuid        REFERENCES school_users(id) ON DELETE SET NULL,
  verified_by               uuid        REFERENCES school_users(id) ON DELETE SET NULL,
  verified_at               timestamptz,
  rejected_reason           text,
  published_at              timestamptz,
  -- Reuses Blueprint's own "historical" freshness vocabulary (ADR-0008)
  -- deliberately, not a new synonym for Achievement's distinct "archived".
  historical_at             timestamptz,
  revoked_by                uuid        REFERENCES school_users(id) ON DELETE SET NULL,
  revoked_reason            text,
  revoked_at                timestamptz,
  withdrawn_reason          text,
  withdrawn_at              timestamptz,

  version                   int         NOT NULL DEFAULT 1,

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learner_competitions_learner_id ON learner_competitions (learner_id, status);
CREATE INDEX IF NOT EXISTS idx_learner_competitions_school_id  ON learner_competitions (school_id);
CREATE INDEX IF NOT EXISTS idx_learner_competitions_project_id ON learner_competitions (project_id) WHERE project_id IS NOT NULL;

-- Team membership — additional learner teammates beyond the primary
-- owning `learner_id` on learner_competitions itself.
CREATE TABLE IF NOT EXISTS competition_members (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id    uuid        NOT NULL REFERENCES learner_competitions(id) ON DELETE CASCADE,
  learner_id        uuid        NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  role              text,
  created_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (competition_id, learner_id)
);

CREATE INDEX IF NOT EXISTS idx_competition_members_competition_id ON competition_members (competition_id);

-- Media, including certificates (ADR-0014 Phase 3: "Certificates... Stored
-- as media on the Competition Entry — the primary, single copy of record").
CREATE TABLE IF NOT EXISTS competition_media (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id    uuid        NOT NULL REFERENCES learner_competitions(id) ON DELETE CASCADE,
  -- Link-out only — no file bytes, no bucket, no upload path (Stop Condition).
  url               text        NOT NULL,
  label             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competition_media_competition_id ON competition_media (competition_id);

-- Append-only audit trail of every lifecycle transition, matching
-- achievement_verification_history/project's own precedent.
CREATE TABLE IF NOT EXISTS competition_history (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id        uuid        NOT NULL REFERENCES learner_competitions(id) ON DELETE CASCADE,
  from_status           text        NOT NULL,
  to_status             text        NOT NULL,
  actor_school_user_id  uuid        REFERENCES school_users(id) ON DELETE SET NULL,
  reason                text,
  version               int         NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competition_history_competition_id ON competition_history (competition_id, version);

ALTER TABLE learner_competitions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_media     ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_history   ENABLE ROW LEVEL SECURITY;

-- School-isolation only, matching learner_achievements'/learner_projects'
-- convention exactly (mission Phase 10: "match Portfolio, Projects,
-- Achievement — no weaker, no stronger permissions"). RLS enforces the
-- tenant boundary; the service layer (lib/learnerCompetitions/) enforces
-- the finer rule that most callers only ever see *published* rows via
-- listPublished(). No write policy for the `authenticated` role — every
-- write goes through the service-role client.
CREATE POLICY "learner_competitions_school_staff_read"
  ON learner_competitions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = learner_competitions.school_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

CREATE POLICY "competition_members_school_staff_read"
  ON competition_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM learner_competitions lc
      JOIN school_users su ON su.school_id = lc.school_id
      WHERE lc.id = competition_members.competition_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

CREATE POLICY "competition_media_school_staff_read"
  ON competition_media FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM learner_competitions lc
      JOIN school_users su ON su.school_id = lc.school_id
      WHERE lc.id = competition_media.competition_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

CREATE POLICY "competition_history_school_staff_read"
  ON competition_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM learner_competitions lc
      JOIN school_users su ON su.school_id = lc.school_id
      WHERE lc.id = competition_history.competition_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

-- Immutability (ADR-0014 Phase 4/6/8, same three-layer discipline as
-- Achievement/Projects/Blueprint Snapshots — Service, Repository, DB
-- trigger, all three, per this sprint's explicit mission). `rejected`/
-- `withdrawn`/`revoked`/`historical` are fully terminal. `published`
-- allows exactly two further transitions — to `historical` or to
-- `revoked` — with every other field frozen. Every earlier status remains
-- editable by the service layer. No delete path exists once a competition
-- has left `opportunity` (matching ADR-0012/0013's identical "no delete
-- path in the frozen lifecycle" rule).
CREATE OR REPLACE FUNCTION enforce_competition_immutability() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status != 'opportunity' THEN
      RAISE EXCEPTION 'learner_competitions row % has left opportunity (status=%) and can never be deleted (Sprint 13B, ADR-0014).', OLD.id, OLD.status;
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status IN ('rejected', 'withdrawn', 'revoked', 'historical') THEN
    RAISE EXCEPTION 'learner_competitions row % is % and permanently immutable (Sprint 13B, ADR-0014).', OLD.id, OLD.status;
  END IF;

  IF OLD.status = 'published' THEN
    IF NEW.status IN ('historical', 'revoked')
       AND NEW.id = OLD.id AND NEW.learner_id = OLD.learner_id AND NEW.school_id = OLD.school_id
       AND NEW.name = OLD.name AND NEW.organizing_body IS NOT DISTINCT FROM OLD.organizing_body
       AND NEW.level = OLD.level AND NEW.category = OLD.category
       AND NEW.event_date IS NOT DISTINCT FROM OLD.event_date AND NEW.venue IS NOT DISTINCT FROM OLD.venue
       AND NEW.project_id IS NOT DISTINCT FROM OLD.project_id
       AND NEW.mentor_school_user_id IS NOT DISTINCT FROM OLD.mentor_school_user_id
       AND NEW.position IS NOT DISTINCT FROM OLD.position
       AND NEW.results_summary IS NOT DISTINCT FROM OLD.results_summary
       AND NEW.judges IS NOT DISTINCT FROM OLD.judges AND NEW.feedback IS NOT DISTINCT FROM OLD.feedback
       AND NEW.supporting_evidence_ids = OLD.supporting_evidence_ids
       AND NEW.recorded_by IS NOT DISTINCT FROM OLD.recorded_by
       AND NEW.verified_by IS NOT DISTINCT FROM OLD.verified_by
       AND NEW.verified_at IS NOT DISTINCT FROM OLD.verified_at
       AND NEW.published_at IS NOT DISTINCT FROM OLD.published_at
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'learner_competitions row % is published and immutable except moving to historical/revoked (Sprint 13B, ADR-0014).', OLD.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_learner_competitions_immutability_update
  BEFORE UPDATE ON learner_competitions
  FOR EACH ROW EXECUTE FUNCTION enforce_competition_immutability();

CREATE TRIGGER trg_learner_competitions_immutability_delete
  BEFORE DELETE ON learner_competitions
  FOR EACH ROW EXECUTE FUNCTION enforce_competition_immutability();

-- History rows are themselves append-only audit records — never edited or
-- deleted, matching achievement_verification_history's own precedent.
CREATE OR REPLACE FUNCTION reject_competition_history_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'competition_history is append-only and can never be updated or deleted (Sprint 13B).';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_competition_history_no_update
  BEFORE UPDATE ON competition_history
  FOR EACH ROW EXECUTE FUNCTION reject_competition_history_mutation();

CREATE TRIGGER trg_competition_history_no_delete
  BEFORE DELETE ON competition_history
  FOR EACH ROW EXECUTE FUNCTION reject_competition_history_mutation();

CREATE OR REPLACE FUNCTION set_learner_competitions_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_learner_competitions_updated_at
  BEFORE UPDATE ON learner_competitions
  FOR EACH ROW EXECUTE FUNCTION set_learner_competitions_updated_at();
