-- Learner Leadership domain (Sprint 13D, ADR-0015).
--
-- Phase 1 re-audit (sprint-13d doc) re-confirmed no leadership repository,
-- service, schema, or route exists anywhere in the codebase. The one real,
-- partial prior implementation is `learner_achievements.achievement_type =
-- 'leadership'` (ADR-0012) — a flat, after-the-fact recognition claim with
-- no selection process, no active-service duration, no review. This
-- migration does not touch `learner_achievements` at all (ADR-0015's
-- "Achievement references Leadership, going forward" is deliberately
-- deferred to a future, Achievement-domain-led migration — see the sprint
-- doc's Known Gaps; this sprint's own mission forbids modifying
-- Achievement's schema or lifecycle, mirroring Sprint 13B's identical
-- deferral for Competitions).
--
-- Lifecycle is ADR-0015 Phase 4's frozen eight-state main line —
-- Nomination, Selection, Active Service, Review, Completion, Verification,
-- Published, Historical — plus four named terminal branches: Not Selected
-- (Nomination -> Not Selected), Discontinued (Active Service/Review ->
-- Discontinued, a neutral factual exit, never a disciplinary record —
-- ADR-0015 Phase 2/11), Rejected (Verification -> Rejected), Revoked
-- (Published -> Revoked). Completion -> Verification is a real, automatic
-- transition (ADR-0015 Phase 4: "system-queued automatically"), the
-- identical pattern already implemented for Competitions' Results ->
-- Verification (Sprint 13B).
--
-- No separate Position/title catalog, election, voting, media, or
-- disciplinary-record table exists here (ADR-0015 Phase 2/3/10/11,
-- mission Stop Condition) — Leadership records only the fact of who was
-- selected, never computes or tallies an election. No upload/storage
-- system is introduced (Stop Condition).

CREATE TABLE IF NOT EXISTS learner_leadership (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id                uuid        NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  school_id                 uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  -- Phase 3 — Leadership Position's own descriptive facts, inline (no
  -- separate Position catalog for v1, mirroring Competition's "no Event
  -- catalog" decision).
  position_title            text        NOT NULL,
  scope                     text,
  body                      text,
  responsibilities          text,
  -- Acting Appointments (Phase 3) — same Entry shape, a flag, never a
  -- second lifecycle.
  is_acting                 boolean     NOT NULL DEFAULT false,

  start_date                date,
  end_date                  date,

  mentor_school_user_id     uuid        REFERENCES school_users(id) ON DELETE SET NULL,

  status                    text        NOT NULL DEFAULT 'nomination' CHECK (status IN (
                               'nomination', 'selection', 'active_service', 'review',
                               'completion', 'verification', 'published', 'historical',
                               'not_selected', 'discontinued', 'rejected', 'revoked'
                             )),

  -- Review phase output (ADR-0015 Phase 3/5/9) — internal-only, never
  -- surfaced to Blueprint or any external audience (Phase 5/9).
  review_notes              text,
  reviewed_by               uuid        REFERENCES school_users(id) ON DELETE SET NULL,
  reviewed_at               timestamptz,

  -- Completion phase output — the factual close-out.
  completed_notes           text,

  -- Leadership Reflection (Phase 3) — explicitly distinct from the
  -- unrelated Teacher Reflection domain (lib/teacherReflection/); scoped
  -- narrowly to this service only, never merged with it.
  reflection                text,

  -- Reference-not-copy, mirroring every sibling domain's own
  -- supporting_evidence_ids pattern (ADR-0015 Phase 3).
  supporting_evidence_ids   uuid[]      NOT NULL DEFAULT '{}',

  -- Attribution only (CLAUDE.md: never an access gate).
  recorded_by               uuid        REFERENCES school_users(id) ON DELETE SET NULL,
  verified_by               uuid        REFERENCES school_users(id) ON DELETE SET NULL,
  verified_at               timestamptz,
  published_at              timestamptz,
  -- Reuses Blueprint's own "historical" freshness vocabulary (ADR-0008)
  -- deliberately, matching Competition's identical choice.
  historical_at             timestamptz,

  not_selected_reason       text,
  -- Discontinued carries only a neutral, factual note (ADR-0015 Phase 2/11
  -- "disciplinary overlap" protection) — never a case file or allegation.
  discontinued_reason       text,
  discontinued_at           timestamptz,
  rejected_reason           text,
  revoked_by                uuid        REFERENCES school_users(id) ON DELETE SET NULL,
  revoked_reason            text,
  revoked_at                timestamptz,

  version                   int         NOT NULL DEFAULT 1,

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learner_leadership_learner_id ON learner_leadership (learner_id, status);
CREATE INDEX IF NOT EXISTS idx_learner_leadership_school_id  ON learner_leadership (school_id);

-- Append-only audit trail of every lifecycle transition, matching
-- competition_history/achievement_verification_history's own precedent.
CREATE TABLE IF NOT EXISTS leadership_history (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  leadership_id         uuid        NOT NULL REFERENCES learner_leadership(id) ON DELETE CASCADE,
  from_status           text        NOT NULL,
  to_status             text        NOT NULL,
  actor_school_user_id  uuid        REFERENCES school_users(id) ON DELETE SET NULL,
  reason                text,
  version               int         NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leadership_history_leadership_id ON leadership_history (leadership_id, version);

ALTER TABLE learner_leadership  ENABLE ROW LEVEL SECURITY;
ALTER TABLE leadership_history  ENABLE ROW LEVEL SECURITY;

-- School-isolation only, matching every sibling domain's convention
-- exactly (mission Phase 3: "no weaker, no stronger permissions"). RLS
-- enforces the tenant boundary; the service layer (lib/learnerLeadership/)
-- enforces the finer rule that most callers only ever see *published*
-- rows via listPublished(). No write policy for the `authenticated` role
-- — every write goes through the service-role client.
CREATE POLICY "learner_leadership_school_staff_read"
  ON learner_leadership FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = learner_leadership.school_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

CREATE POLICY "leadership_history_school_staff_read"
  ON leadership_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM learner_leadership ll
      JOIN school_users su ON su.school_id = ll.school_id
      WHERE ll.id = leadership_history.leadership_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

-- Immutability (ADR-0015 Phase 4/11, same three-layer discipline as
-- Achievement/Projects/Competitions — Service, Repository, DB trigger, all
-- three, per this sprint's explicit mission). `not_selected`/
-- `discontinued`/`rejected`/`revoked`/`historical` are fully terminal.
-- `published` allows exactly two further transitions — to `historical` or
-- to `revoked` — with every other field frozen. Every earlier status
-- remains editable by the service layer. No delete path exists once a
-- leadership entry has left `nomination`.
CREATE OR REPLACE FUNCTION enforce_leadership_immutability() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status != 'nomination' THEN
      RAISE EXCEPTION 'learner_leadership row % has left nomination (status=%) and can never be deleted (Sprint 13D, ADR-0015).', OLD.id, OLD.status;
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status IN ('not_selected', 'discontinued', 'rejected', 'revoked', 'historical') THEN
    RAISE EXCEPTION 'learner_leadership row % is % and permanently immutable (Sprint 13D, ADR-0015).', OLD.id, OLD.status;
  END IF;

  IF OLD.status = 'published' THEN
    IF NEW.status IN ('historical', 'revoked')
       AND NEW.id = OLD.id AND NEW.learner_id = OLD.learner_id AND NEW.school_id = OLD.school_id
       AND NEW.position_title = OLD.position_title AND NEW.scope IS NOT DISTINCT FROM OLD.scope
       AND NEW.body IS NOT DISTINCT FROM OLD.body AND NEW.responsibilities IS NOT DISTINCT FROM OLD.responsibilities
       AND NEW.is_acting = OLD.is_acting
       AND NEW.start_date IS NOT DISTINCT FROM OLD.start_date AND NEW.end_date IS NOT DISTINCT FROM OLD.end_date
       AND NEW.mentor_school_user_id IS NOT DISTINCT FROM OLD.mentor_school_user_id
       AND NEW.review_notes IS NOT DISTINCT FROM OLD.review_notes
       AND NEW.reviewed_by IS NOT DISTINCT FROM OLD.reviewed_by AND NEW.reviewed_at IS NOT DISTINCT FROM OLD.reviewed_at
       AND NEW.completed_notes IS NOT DISTINCT FROM OLD.completed_notes
       AND NEW.reflection IS NOT DISTINCT FROM OLD.reflection
       AND NEW.supporting_evidence_ids = OLD.supporting_evidence_ids
       AND NEW.recorded_by IS NOT DISTINCT FROM OLD.recorded_by
       AND NEW.verified_by IS NOT DISTINCT FROM OLD.verified_by AND NEW.verified_at IS NOT DISTINCT FROM OLD.verified_at
       AND NEW.published_at IS NOT DISTINCT FROM OLD.published_at
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'learner_leadership row % is published and immutable except moving to historical/revoked (Sprint 13D, ADR-0015).', OLD.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_learner_leadership_immutability_update
  BEFORE UPDATE ON learner_leadership
  FOR EACH ROW EXECUTE FUNCTION enforce_leadership_immutability();

CREATE TRIGGER trg_learner_leadership_immutability_delete
  BEFORE DELETE ON learner_leadership
  FOR EACH ROW EXECUTE FUNCTION enforce_leadership_immutability();

-- History rows are themselves append-only audit records — never edited or
-- deleted, matching competition_history's own precedent.
CREATE OR REPLACE FUNCTION reject_leadership_history_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'leadership_history is append-only and can never be updated or deleted (Sprint 13D).';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_leadership_history_no_update
  BEFORE UPDATE ON leadership_history
  FOR EACH ROW EXECUTE FUNCTION reject_leadership_history_mutation();

CREATE TRIGGER trg_leadership_history_no_delete
  BEFORE DELETE ON leadership_history
  FOR EACH ROW EXECUTE FUNCTION reject_leadership_history_mutation();

CREATE OR REPLACE FUNCTION set_learner_leadership_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_learner_leadership_updated_at
  BEFORE UPDATE ON learner_leadership
  FOR EACH ROW EXECUTE FUNCTION set_learner_leadership_updated_at();
