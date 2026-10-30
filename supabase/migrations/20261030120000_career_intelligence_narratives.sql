-- 20261030120000_career_intelligence_narratives.sql
--
-- Reuse store for the ONE AI-generated part of the Career Intelligence Report
-- (lib/career/careerIntelligenceEngine.ts, generateNarrativeSections).
--
-- Every open of the report used to re-run the DeepSeek narrative call and
-- re-charge the parent (docs/audits/ai-call-efficiency-deep-audit.md AI-02,
-- F-10), producing a different narrative each time from identical evidence.
-- The deterministic sections are still recomputed live on every view; only
-- the narrative is reused, and only while its inputs are unchanged:
--
--   input_fingerprint = sha256(prompt_version + every value the narrative
--   prompt receives: grade, age, pathway, capability clusters, strong/weak
--   subjects, readiness, top matches, dream career, assessment count,
--   confidence, mode).
--
-- New evidence that changes any of those inputs produces a new fingerprint and
-- a fresh narrative; a prompt change bumps prompt_version and does the same.
--
-- `narrative` is stored in pseudonymised form — the learner is the
-- {{LEARNER}} placeholder, restored to the current first name at read time —
-- so this table holds no learner name.
--
-- Access: service role only (the report route reads/writes it after its own
-- owner/parent authorisation). No anon/authenticated policy exists, so
-- client-side access is denied by RLS.
--
-- Additive only. The application treats a missing table as "nothing cached",
-- so code and migration can be deployed in either order.
--
-- Rollback:
--   DROP TABLE IF EXISTS public.career_intelligence_narratives;
--   DROP FUNCTION IF EXISTS public.set_career_intelligence_narratives_updated_at();

BEGIN;

CREATE TABLE IF NOT EXISTS public.career_intelligence_narratives (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        uuid        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  input_fingerprint text        NOT NULL,
  prompt_version    text        NOT NULL,
  narrative         jsonb       NOT NULL,
  model             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  -- One narrative per learner per distinct input set. Its leading column
  -- also serves as the index on the student_id foreign key.
  CONSTRAINT career_intelligence_narratives_student_fingerprint_key UNIQUE (student_id, input_fingerprint)
);

CREATE OR REPLACE FUNCTION public.set_career_intelligence_narratives_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_career_intelligence_narratives_updated_at ON public.career_intelligence_narratives;
CREATE TRIGGER trg_career_intelligence_narratives_updated_at
  BEFORE UPDATE ON public.career_intelligence_narratives
  FOR EACH ROW EXECUTE FUNCTION public.set_career_intelligence_narratives_updated_at();

ALTER TABLE public.career_intelligence_narratives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "career_intelligence_narratives: service role full access"
  ON public.career_intelligence_narratives
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
