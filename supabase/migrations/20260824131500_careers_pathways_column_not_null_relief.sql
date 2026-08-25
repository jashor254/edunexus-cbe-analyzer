-- careers.pathways: drop the orphaned NOT NULL that blocks every publish
--
-- Discovered while proving the Phase 9.1.5 review-publish fix end-to-end
-- (docs/architecture/phase9-1-5-review-publish-correctness.md): `careers` has
-- TWO pathway columns — `pathways` (jsonb, legacy, not null) and `pathway`
-- (text, the one lib/career/types.ts's Career type and all application code
-- actually reads/writes). Repo-wide search found zero application code
-- anywhere reads or writes `careers.pathways` — every hit for the word
-- "pathways" elsewhere in the codebase is unrelated prose or the distinct
-- lib/pathwayCalculator.ts domain. Because `upsertCareer()` only ever sets
-- `pathway` (singular), any publish of an AI-generated career fails with
-- `null value in column "pathways" violates not-null constraint` —
-- independently of and in addition to the status-check bug this phase's
-- prior migration fixed. Both bugs block the same acceptance path (a human
-- publishing a reviewed career), so this is a directly-exposed correctness
-- fix, not unrelated schema cleanup.
--
-- Column is kept (not dropped) — genuinely unrelated cleanup is out of this
-- phase's scope, and dropping a column neither the audit nor this fix has
-- fully traced is a bigger, separate decision than "stop blocking every
-- write no one populates this for."

alter table public.careers
  alter column pathways drop not null;
