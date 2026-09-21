-- Paper Intelligence Prototype 01 — Gate 6 (durable evidence-write failure
-- logging). A photographed learner page is not trivially recoverable the
-- way a re-gradable quiz is — a swallowed "vision succeeded, evidence write
-- failed" (the existing after()+console.error pattern used by
-- lib/assignments/evidence.ts and lib/quiz/quizEvidence.ts, per the
-- pre-build audit) is not an acceptable failure mode here.
--
-- Deliberately its own small table, not a repurposing of ai_call_logs
-- (that table logs the AI CALL's own success/cost — reused as-is for that
-- purpose, see lib/ai/logger.ts) or job_logs/webhook_errors (different
-- subsystems, different semantics). This table exists for exactly one
-- question: "did a Paper Intelligence evidence write fail, and what do we
-- need to retry/diagnose it." No job queue, no retry engine — a durable
-- record a human or a future script can act on.

CREATE TABLE IF NOT EXISTS paper_intelligence_failures (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         uuid        REFERENCES schools(id) ON DELETE SET NULL,
  assignment_id     uuid        REFERENCES assignments(id) ON DELETE SET NULL,
  -- Nullable: identity may not have resolved by the point of failure.
  student_id        uuid        REFERENCES students(id) ON DELETE SET NULL,
  question_number   int,
  -- Storage path, never the image bytes themselves.
  image_ref         text,
  operation         text        NOT NULL CHECK (operation IN ('vision_call', 'evidence_write')),
  error_category    text        NOT NULL,
  error_message     text,
  correlation_id    text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paper_intelligence_failures_created_at
  ON paper_intelligence_failures (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_paper_intelligence_failures_assignment_id
  ON paper_intelligence_failures (assignment_id);

ALTER TABLE paper_intelligence_failures ENABLE ROW LEVEL SECURITY;

-- Service-role writes only (the producer runs entirely server-side, inside
-- an after() callback — no end-user session exists at write time). No
-- authenticated-role policy, matching learner_evidence's own posture.
