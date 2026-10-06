-- Career knowledge provenance: `careers.verification_source`
--
-- FIX 6 of the Career Intelligence corrective pass
-- (docs/architecture/adr-0033-career-intelligence-corrective-pass.md).
--
-- Problem this fixes: `knowledge_verified_at` records WHEN a career's facts were
-- confirmed but not WHO or WHAT confirmed them. A hand-curated seed row, a
-- human-reviewed AI draft, and a row of unknown origin all rendered as plain
-- "fresh" once dated. They are not the same claim, and a family reading a
-- salary band deserves to know which one it is.
--
-- Values:
--   human        — hand-curated, human-authored canonical knowledge
--                  (the curated seed corpus, or a person re-verifying a row
--                  through the admin human-verify action).
--   source_cited — AI-drafted content a person reviewed and published through
--                  the human review gate (publishReviewedCareer).
--   ai_drafted   — generated material that has NOT passed human review. Never
--                  presented as verified knowledge.
--   NULL         — provenance not recorded. Deliberately NOT defaulted to any
--                  of the above: guessing would be the exact failure this
--                  column exists to prevent. Treated as not-fresh by
--                  lib/career/knowledgeLifecycle.ts until a person verifies it.
--
-- Add → Backfill → Verify → Observe. Nothing is deprecated or deleted.

-- ── Add ──────────────────────────────────────────────────────────────────────

alter table public.careers
  add column if not exists verification_source text;

alter table public.careers
  drop constraint if exists careers_verification_source_check;

alter table public.careers
  add constraint careers_verification_source_check
  check (verification_source is null or verification_source in ('human', 'source_cited', 'ai_drafted'));

comment on column public.careers.verification_source is
  'Who or what confirmed this career''s facts: human (hand-curated / person-verified) | source_cited (AI draft reviewed and published by a person) | ai_drafted (unreviewed, never presented as verified). NULL = provenance not recorded; treated as not-fresh until a person verifies it. Read through lib/career/knowledgeLifecycle.ts, never bare.';

-- ── Backfill ─────────────────────────────────────────────────────────────────
--
-- Only rows with positive evidence are classified. Audit at authoring time
-- (2026-10-06, read-only): 43 rows, all source='seed'.
--
--   18 rows carry knowledge_source_note = 'Curated seed corpus
--      (lib/career/seedCareers.ts)' — the hand-curated seed file, re-verified
--      by running runSeed on 2026-08-13. → human.
--
--   25 rows (created 2026-06-16, knowledge_source_note NULL) are NOT in
--      seedCareers.ts. Their names trace to the Academic Clinic career list
--      (lib/academicClinic/careerEngine.ts) and their capability metadata to
--      scripts/seed-cos-batch2.ts, but no file in the repository contains their
--      full profiles (doors, salary bands, AI impact), and their
--      knowledge_verified_at was itself backfilled from updated_at by
--      20260813140000_career_knowledge_lifecycle.sql — a row-write date, not a
--      confirmation event. Authorship cannot be established from evidence, so
--      they stay NULL and are listed for manual review in the ADR.
--
--   0 rows are source_cited: career_review_queue has never published a row.

update public.careers
   set verification_source = 'human'
 where verification_source is null
   and knowledge_source_note = 'Curated seed corpus (lib/career/seedCareers.ts)';

-- ── Verify (run after applying; expected at authoring time: human 18, NULL 25)
--
--   select verification_source, count(*) from public.careers group by 1 order by 1;
--
-- ── Rollback ─────────────────────────────────────────────────────────────────
--
--   alter table public.careers drop constraint if exists careers_verification_source_check;
--   alter table public.careers drop column if exists verification_source;
--
-- Application code reads this column (CAREER_COS_COLS / CAREER_COLS), so roll
-- back the code before the column, and apply this migration before deploying
-- the code that selects it.
