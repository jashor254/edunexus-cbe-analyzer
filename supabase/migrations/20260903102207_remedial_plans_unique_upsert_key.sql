-- remedial_plans: add the unique index upsertRemedialPlan() has always assumed
--
-- Discovered during the F1/F6 authorization closure pass (forensic
-- verification, 2026-09-03): lib/repositories/learner-intelligence
-- .repository.ts's upsertRemedialPlan() issues
-- `.upsert(..., { onConflict: 'sow_id,teacher_id,sub_strand,term,year' })`,
-- but remedial_plans (a pre-history table, recovered verbatim from
-- production's own schema_migrations.statements into
-- scripts/bootstrap-local-db/00-baseline/11-learning-intelligence-foundation.sql
-- — never touched by any tracked migration since) has only ever had three
-- ordinary, non-unique indexes (sow_id, teacher_id, class_id) plus its
-- primary key. Confirmed directly against production's live pg_constraint/
-- pg_index catalogs: zero unique constraint or index covers this 5-column
-- key. Every call to POST /api/remedial/generate has therefore failed at
-- this exact step with "there is no unique or exclusion constraint matching
-- the ON CONFLICT specification" — independent of authorization, teacher,
-- or class — since this persistence call was written. Production's
-- remedial_plans currently holds zero rows (verified read-only,
-- 2026-09-03), so there is no duplicate-key data to reconcile.
--
-- This migration's sole purpose is making that existing, unchanged
-- application contract valid. No application code, index, constraint, or
-- policy other than this one new index is touched.

create unique index if not exists remedial_plans_sow_teacher_substrand_term_year_key
  on public.remedial_plans (sow_id, teacher_id, sub_strand, term, year);
