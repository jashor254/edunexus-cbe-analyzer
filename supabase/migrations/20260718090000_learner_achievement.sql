-- Learner Achievement domain (Sprint 12W, ADR-0012).
--
-- Phase 1 audit (sprint-12w doc) re-confirmed no existing table, badge
-- system, or gamification feature owns any part of a learner-facing,
-- evidence-backed Achievement — `lib/academy/portfolio.ts` is Academy's
-- unrelated teacher badge system, `app/*/groups` is unrelated gamified
-- study groups, and `lib/learnerPortfolio/` (Sprint 12V) was deliberately
-- scoped to exclude every achievement-owned concept.
--
-- Lifecycle is exactly ADR-0012 Phase 4's frozen six states — Draft,
-- Verified, Published, Rejected, Revoked, Archived. There is no separate
-- "Submitted" state: Draft moves directly to Verified or Rejected via a
-- single teacher verification action (Phase 9: the verifying actor may be
-- the same school actor who recorded it, for an internally-witnessed
-- achievement). "Expired" is deliberately not a stored state (Phase 4) —
-- `expires_at` is data; expiry is a computed, read-time fact.
--
-- Achievement Type (Phase 2) and Category (Phase 8) are two separate
-- frozen fields, never conflated into one.
--
-- No upload/storage system is introduced here (Forbidden list) —
-- `achievement_media` stores external link-out URLs only, never file bytes.

CREATE TABLE IF NOT EXISTS learner_achievements (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id                uuid        NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  school_id                 uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  -- Phase 2 — the umbrella sub-type of achievement.
  achievement_type          text        NOT NULL CHECK (achievement_type IN (
                               'certificate', 'competition', 'leadership', 'community_service',
                               'innovation', 'creative_work', 'participation'
                             )),
  -- Phase 8 — the frozen ten-category classification, independent of type.
  category                  text        NOT NULL CHECK (category IN (
                               'academic', 'leadership', 'innovation', 'community_service',
                               'creative_arts', 'sports', 'entrepreneurship', 'research',
                               'technology', 'other'
                             )),

  title                     text        NOT NULL,
  description               text,

  -- Phase 5 — reference-not-copy, mirroring learner_projections' own
  -- supporting_evidence_ids pattern. `verifying_document_reference` covers
  -- claims that predate the Evidence system's own scope (e.g. an external
  -- certificate with a physical/scanned document as its basis) — never a
  -- second copy of Evidence's own confidence/lifecycle machinery.
  supporting_evidence_ids   uuid[]      NOT NULL DEFAULT '{}',
  verifying_document_reference text,

  awarding_organization     text,
  award_date                date        NOT NULL,
  -- Data, never a stored lifecycle state (Phase 4's "Expired is computed"
  -- rule, extending ADR-0004's derived-data discipline).
  expires_at                date,

  status                    text        NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft', 'verified', 'published', 'rejected', 'revoked', 'archived')),
  -- Incremented on every lifecycle transition — correlates with
  -- achievement_verification_history rows, never a re-submission cycle
  -- counter (unlike teacher_reflections' per-cycle version).
  version                   int         NOT NULL DEFAULT 1,

  -- Attribution only (CLAUDE.md: never an access gate).
  recorded_by               uuid        REFERENCES school_users(id) ON DELETE SET NULL,
  verified_by               uuid        REFERENCES school_users(id) ON DELETE SET NULL,
  verified_at               timestamptz,
  rejected_reason           text,
  published_at              timestamptz,
  revoked_by                uuid        REFERENCES school_users(id) ON DELETE SET NULL,
  revoked_reason            text,
  revoked_at                timestamptz,
  archived_at               timestamptz,

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learner_achievements_learner_id ON learner_achievements (learner_id, status);
CREATE INDEX IF NOT EXISTS idx_learner_achievements_school_id  ON learner_achievements (school_id);

CREATE TABLE IF NOT EXISTS achievement_media (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  achievement_id    uuid        NOT NULL REFERENCES learner_achievements(id) ON DELETE CASCADE,
  -- Link-out only — no file bytes, no bucket, no upload path (Forbidden list).
  url               text        NOT NULL,
  label             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_achievement_media_achievement_id ON achievement_media (achievement_id);

CREATE TABLE IF NOT EXISTS achievement_tags (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  achievement_id    uuid        NOT NULL REFERENCES learner_achievements(id) ON DELETE CASCADE,
  tag               text        NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (achievement_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_achievement_tags_achievement_id ON achievement_tags (achievement_id);

-- Append-only audit trail of every lifecycle transition (Phase 11's
-- "Version history" testing requirement) — distinct from the current-state
-- fields on learner_achievements itself, never a second copy of them.
CREATE TABLE IF NOT EXISTS achievement_verification_history (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  achievement_id    uuid        NOT NULL REFERENCES learner_achievements(id) ON DELETE CASCADE,
  from_status        text        NOT NULL,
  to_status          text        NOT NULL,
  actor_school_user_id uuid      REFERENCES school_users(id) ON DELETE SET NULL,
  reason             text,
  version            int         NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_achievement_verification_history_achievement_id ON achievement_verification_history (achievement_id, version);

ALTER TABLE learner_achievements              ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievement_media                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievement_tags                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievement_verification_history  ENABLE ROW LEVEL SECURITY;

-- School-isolation only, matching learner_portfolios/teacher_reflections'
-- convention — RLS enforces the tenant boundary; the service layer
-- (lib/learnerAchievement/) enforces the finer rule that most callers only
-- ever see *published* rows via listPublished(). No write policy for the
-- `authenticated` role — every write goes through the service-role client.
CREATE POLICY "learner_achievements_school_staff_read"
  ON learner_achievements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM school_users su
      WHERE su.school_id = learner_achievements.school_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

CREATE POLICY "achievement_media_school_staff_read"
  ON achievement_media FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM learner_achievements la
      JOIN school_users su ON su.school_id = la.school_id
      WHERE la.id = achievement_media.achievement_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

CREATE POLICY "achievement_tags_school_staff_read"
  ON achievement_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM learner_achievements la
      JOIN school_users su ON su.school_id = la.school_id
      WHERE la.id = achievement_tags.achievement_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

CREATE POLICY "achievement_verification_history_school_staff_read"
  ON achievement_verification_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM learner_achievements la
      JOIN school_users su ON su.school_id = la.school_id
      WHERE la.id = achievement_verification_history.achievement_id
        AND su.user_id = auth.uid()
        AND su.is_active = true
    )
  );

-- Immutability (Phase 4/11: "No delete path exists in this domain's frozen
-- lifecycle... only Revoked/Archived, both preserving the row forever").
-- `rejected`/`revoked`/`archived` are fully terminal (Phase 4 explicitly
-- calls Rejected "a distinct terminal state"). `published` allows exactly
-- two further transitions — to `archived` or to `revoked` — with every
-- other field frozen. `draft`/`verified` remain editable by the service
-- layer; DELETE is legal only while still `draft`.
CREATE OR REPLACE FUNCTION enforce_achievement_immutability() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status != 'draft' THEN
      RAISE EXCEPTION 'learner_achievements row % has left draft (status=%) and can never be deleted (Sprint 12W, ADR-0012 Phase 4/11).', OLD.id, OLD.status;
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status IN ('rejected', 'revoked', 'archived') THEN
    RAISE EXCEPTION 'learner_achievements row % is % and permanently immutable (Sprint 12W, ADR-0012 Phase 4).', OLD.id, OLD.status;
  END IF;

  IF OLD.status = 'published' THEN
    IF NEW.status IN ('archived', 'revoked')
       AND NEW.id = OLD.id AND NEW.learner_id = OLD.learner_id AND NEW.school_id = OLD.school_id
       AND NEW.achievement_type = OLD.achievement_type AND NEW.category = OLD.category
       AND NEW.title = OLD.title AND NEW.description IS NOT DISTINCT FROM OLD.description
       AND NEW.supporting_evidence_ids = OLD.supporting_evidence_ids
       AND NEW.verifying_document_reference IS NOT DISTINCT FROM OLD.verifying_document_reference
       AND NEW.awarding_organization IS NOT DISTINCT FROM OLD.awarding_organization
       AND NEW.award_date = OLD.award_date AND NEW.expires_at IS NOT DISTINCT FROM OLD.expires_at
       AND NEW.recorded_by IS NOT DISTINCT FROM OLD.recorded_by
       AND NEW.verified_by IS NOT DISTINCT FROM OLD.verified_by
       AND NEW.verified_at IS NOT DISTINCT FROM OLD.verified_at
       AND NEW.published_at IS NOT DISTINCT FROM OLD.published_at
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'learner_achievements row % is published and immutable except archiving/revoking (Sprint 12W, ADR-0012 Phase 4).', OLD.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_learner_achievements_immutability_update
  BEFORE UPDATE ON learner_achievements
  FOR EACH ROW EXECUTE FUNCTION enforce_achievement_immutability();

CREATE TRIGGER trg_learner_achievements_immutability_delete
  BEFORE DELETE ON learner_achievements
  FOR EACH ROW EXECUTE FUNCTION enforce_achievement_immutability();

-- Verification history rows are themselves append-only audit records —
-- never edited or deleted, matching evidence_audit_log's own precedent.
CREATE OR REPLACE FUNCTION reject_achievement_history_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'achievement_verification_history is append-only and can never be updated or deleted (Sprint 12W).';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_achievement_verification_history_no_update
  BEFORE UPDATE ON achievement_verification_history
  FOR EACH ROW EXECUTE FUNCTION reject_achievement_history_mutation();

CREATE TRIGGER trg_achievement_verification_history_no_delete
  BEFORE DELETE ON achievement_verification_history
  FOR EACH ROW EXECUTE FUNCTION reject_achievement_history_mutation();

CREATE OR REPLACE FUNCTION set_learner_achievements_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_learner_achievements_updated_at
  BEFORE UPDATE ON learner_achievements
  FOR EACH ROW EXECUTE FUNCTION set_learner_achievements_updated_at();
