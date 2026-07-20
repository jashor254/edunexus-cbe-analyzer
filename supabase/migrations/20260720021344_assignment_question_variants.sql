-- Sprint 9 Slice 1 (ADR-0025/Sprint 4B design, Sprint 4A.1 design) —
-- canonical question identity + variant persistence schema. No AI
-- generation, no delivery/grading changes, no UI in this slice — purely the
-- foundation those later slices build on.
--
-- Part 1 — Canonical Question Identity (Sprint 4A.1)
--
-- Fixes the one real blocker Sprint 4A/4A.1 found before any variant table
-- could safely exist: lib/quiz/quiz.ts's replaceQuestions() deleted and
-- recreated every assignment_questions row on every teacher save (fresh
-- UUIDs each time). Any assignment_question_variants row FK'd to
-- question_id would have been silently cascade-deleted on the next quiz
-- builder save. Fixed two ways, both DB-enforced, not app discipline:
--   1. A lock trigger — once real submission activity exists for an
--      assignment (a submission with status IN ('submitted','marked')),
--      its assignment_questions rows become immutable. Deliberately NOT
--      keyed off assignments.status — a quiz assignment is created with
--      status='active' immediately and its questions are populated
--      *afterward* via the quiz builder (app/teacher/assignments/new/page.tsx
--      redirects straight to the builder); a status-keyed lock would break
--      that already-working flow. Submission-activity is the correct,
--      narrower signal.
--   2. replace_assignment_questions() — an atomic, ID-preserving upsert
--      RPC replacing quiz.ts's old client-side delete-then-insert. One
--      transaction: matched questions (by id) are updated in place, new
--      ones inserted, removed ones deleted. The lock trigger fires inside
--      this same transaction, so a locked assignment's write fails
--      atomically with no partial application.

CREATE OR REPLACE FUNCTION enforce_assignment_questions_lock() RETURNS trigger AS $$
DECLARE
  v_assignment_id uuid;
  v_locked boolean;
BEGIN
  v_assignment_id := COALESCE(NEW.assignment_id, OLD.assignment_id);

  SELECT EXISTS (
    SELECT 1 FROM assignment_submissions
    WHERE assignment_id = v_assignment_id
      AND status IN ('submitted', 'marked')
  ) INTO v_locked;

  IF v_locked THEN
    RAISE EXCEPTION 'assignment_questions is locked for assignment % — real submission activity already exists (Sprint 4A.1 canonical question identity invariant). Create a new assignment instead of editing a published quiz''s questions.', v_assignment_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_assignment_questions_lock
  BEFORE INSERT OR UPDATE OR DELETE ON assignment_questions
  FOR EACH ROW EXECUTE FUNCTION enforce_assignment_questions_lock();

-- Ownership (teacher owns this assignment) is verified by the caller before
-- this RPC is ever invoked (app/api/teacher/assignments/[id]/questions's PUT
-- route already calls requireClassTeacher() first) — this function trusts
-- its caller the same way every other lib/ function in this codebase trusts
-- its route's auth check, since it's always called via the service-role
-- client (auth.uid() is not populated in that context, so an in-function
-- auth check here would be meaningless, not an extra safety layer).
CREATE OR REPLACE FUNCTION replace_assignment_questions(
  p_assignment_id uuid,
  p_questions     jsonb   -- array of {id?: uuid, question_text: text, choices: text[], correct_index: int}
) RETURNS SETOF assignment_questions AS $$
DECLARE
  v_incoming_ids uuid[];
  q jsonb;
  v_order int := 0;
BEGIN
  SELECT array_agg((elem->>'id')::uuid)
  INTO v_incoming_ids
  FROM jsonb_array_elements(p_questions) elem
  WHERE elem ? 'id' AND elem->>'id' IS NOT NULL;

  -- Explicit removal: any existing row not present (by id) in the incoming
  -- array is deleted — never an implicit side effect of the upsert below.
  DELETE FROM assignment_questions
  WHERE assignment_id = p_assignment_id
    AND (v_incoming_ids IS NULL OR NOT (id = ANY(v_incoming_ids)));

  FOR q IN SELECT * FROM jsonb_array_elements(p_questions)
  LOOP
    IF q ? 'id' AND q->>'id' IS NOT NULL THEN
      UPDATE assignment_questions
      SET question_text = q->>'question_text',
          choices       = ARRAY(SELECT jsonb_array_elements_text(q->'choices')),
          correct_index = (q->>'correct_index')::int,
          order_index   = v_order
      WHERE id = (q->>'id')::uuid AND assignment_id = p_assignment_id;
    ELSE
      INSERT INTO assignment_questions (assignment_id, question_text, choices, correct_index, order_index)
      VALUES (
        p_assignment_id,
        q->>'question_text',
        ARRAY(SELECT jsonb_array_elements_text(q->'choices')),
        (q->>'correct_index')::int,
        v_order
      );
    END IF;
    v_order := v_order + 1;
  END LOOP;

  RETURN QUERY
    SELECT * FROM assignment_questions
    WHERE assignment_id = p_assignment_id
    ORDER BY order_index;
END;
$$ LANGUAGE plpgsql;

-- Part 2 — Variant Persistence (Sprint 4B design: Option A, confirmed
-- independently four times across this series' design docs before this
-- migration). One row per (canonical question, instructional tier).
-- 'independent' (on_track / expected curriculum level) is deliberately NOT
-- a stored variant_type value — the canonical assignment_questions row
-- already IS that tier's content; storing a fourth identical-tier row would
-- be a duplicate write path for the same fact.

CREATE TABLE IF NOT EXISTS assignment_question_variants (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id             uuid        NOT NULL REFERENCES assignment_questions(id) ON DELETE CASCADE,
  variant_type             text        NOT NULL CHECK (variant_type IN ('foundation', 'supported_practice', 'extension')),
  question_text            text        NOT NULL,
  choices                  text[]      NOT NULL,
  correct_index            int         NOT NULL,
  cognitive_intent         text,
  difficulty_rationale     text,
  expected_misconceptions  text[]      NOT NULL DEFAULT '{}',
  teacher_explanation      text,
  learner_explanation      text,
  status                   text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected', 'archived')),
  generated_by             text        NOT NULL DEFAULT 'ai' CHECK (generated_by IN ('ai', 'teacher_edited')),
  -- Display-only curriculum reference, copied verbatim at generation time —
  -- never re-resolved, matching SubStrandPerformance's own established
  -- discipline (lib/projection/types.ts). Nullable: honest when the
  -- assignment's own curriculum grounding was itself subject-level only.
  sub_strand_id            uuid        REFERENCES sow_substrands(id),
  learning_outcome         text,
  -- Archive-never-delete, mirroring learner_evidence's supersedes/superseded_by.
  supersedes               uuid        REFERENCES assignment_question_variants(id),
  superseded_by            uuid        REFERENCES assignment_question_variants(id),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  approved_at              timestamptz,
  archived_at              timestamptz
);

-- The one DB-level guarantee this whole design leans on: at most one
-- servable ("approved") variant per (question, tier) at any moment.
CREATE UNIQUE INDEX IF NOT EXISTS assignment_question_variants_one_approved
  ON assignment_question_variants (question_id, variant_type)
  WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_assignment_question_variants_question_id
  ON assignment_question_variants (question_id, variant_type);

ALTER TABLE assignment_question_variants ENABLE ROW LEVEL SECURITY;

-- Teacher-only RLS, same shape as assignment_questions' own policy — no
-- student/parent SELECT policy at all. A variant's correct_index must
-- never be readable by a student's own session before they submit; the
-- student-facing serving route (Sprint 4C, not built in this slice) will
-- follow the same "server strips the sensitive field via the service-role
-- client" posture assignment_questions already established.
CREATE POLICY "assignment_question_variants: teacher crud"
  ON assignment_question_variants FOR ALL
  USING (
    question_id IN (
      SELECT aq.id FROM assignment_questions aq
      JOIN assignments a ON a.id = aq.assignment_id
      WHERE a.teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    question_id IN (
      SELECT aq.id FROM assignment_questions aq
      JOIN assignments a ON a.id = aq.assignment_id
      WHERE a.teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
    )
  );

-- Lifecycle transition guard — DB-enforced, not just app discipline,
-- mirroring learner_evidence's own trg_learner_evidence_lifecycle_transition.
-- An approved or rejected variant can only ever become archived (via
-- regeneration); it can never be edited in place or silently un-approved.
-- An archived row is immutable, full stop.
CREATE OR REPLACE FUNCTION enforce_variant_lifecycle_transition() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'archived' THEN
    RAISE EXCEPTION 'assignment_question_variants row % is archived and immutable.', OLD.id;
  END IF;

  IF OLD.status IN ('approved', 'rejected') AND NEW.status NOT IN (OLD.status, 'archived') THEN
    RAISE EXCEPTION 'Invalid variant lifecycle transition % -> % on row % — % variants may only become archived (via regeneration), never edited in place.', OLD.status, NEW.status, OLD.id, OLD.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_variant_lifecycle_transition
  BEFORE UPDATE ON assignment_question_variants
  FOR EACH ROW EXECUTE FUNCTION enforce_variant_lifecycle_transition();

-- Atomic regeneration: archive the old row and insert the new one in a
-- single transaction — never two separate calls, which could leave a
-- question with either two "live-looking" rows or none on partial failure.
CREATE OR REPLACE FUNCTION regenerate_assignment_question_variant(
  p_old_variant_id uuid,
  p_new_variant    jsonb  -- {question_text, choices, correct_index, cognitive_intent?,
                          --  difficulty_rationale?, expected_misconceptions?,
                          --  teacher_explanation?, learner_explanation?}
) RETURNS assignment_question_variants AS $$
DECLARE
  v_old assignment_question_variants;
  v_new assignment_question_variants;
BEGIN
  SELECT * INTO v_old FROM assignment_question_variants WHERE id = p_old_variant_id;
  IF v_old.id IS NULL THEN
    RAISE EXCEPTION 'Variant % not found', p_old_variant_id;
  END IF;
  IF v_old.status = 'archived' THEN
    RAISE EXCEPTION 'Variant % is already archived', p_old_variant_id;
  END IF;

  INSERT INTO assignment_question_variants (
    question_id, variant_type, question_text, choices, correct_index,
    cognitive_intent, difficulty_rationale, expected_misconceptions,
    teacher_explanation, learner_explanation, status, generated_by,
    sub_strand_id, learning_outcome, supersedes
  ) VALUES (
    v_old.question_id, v_old.variant_type,
    p_new_variant->>'question_text',
    ARRAY(SELECT jsonb_array_elements_text(p_new_variant->'choices')),
    (p_new_variant->>'correct_index')::int,
    p_new_variant->>'cognitive_intent',
    p_new_variant->>'difficulty_rationale',
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(p_new_variant->'expected_misconceptions', '[]'::jsonb)) x), '{}'),
    p_new_variant->>'teacher_explanation',
    p_new_variant->>'learner_explanation',
    'draft', 'ai',
    v_old.sub_strand_id, v_old.learning_outcome,
    v_old.id
  )
  RETURNING * INTO v_new;

  UPDATE assignment_question_variants
  SET status = 'archived', archived_at = now(), superseded_by = v_new.id
  WHERE id = p_old_variant_id;

  RETURN v_new;
END;
$$ LANGUAGE plpgsql;

-- assignment_submissions gains one additive column (Sprint 4B/4C design) —
-- not populated or read by any code in this slice; the delivery/grading
-- work that reads and writes it is a separate, later slice.
ALTER TABLE assignment_submissions
  ADD COLUMN IF NOT EXISTS served_variant_map jsonb;
