-- academic_reports has no CREATE TABLE anywhere in repo or production
-- migration history (H1M-R2: confirmed via exhaustive search of
-- supabase_migrations.schema_migrations.statements — only 2 pre-Evidence
-- migrations touch it, both ALTER/policy, never CREATE). This is the
-- proven pre-20260525 historical form: current live structure MINUS
-- updated_at (added by performance_indexes) MINUS its one RLS policy
-- (added by rls_policies). Both of those additions remain the
-- responsibility of the real tracked migrations later in the replay —
-- do not duplicate them here.
CREATE TABLE IF NOT EXISTS public.academic_reports (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          uuid,
  assessment_id       uuid,
  report_data         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  pathway_recommended text,
  is_premium_unlocked boolean     DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_academic_reports_student_id ON public.academic_reports(student_id);

ALTER TABLE public.academic_reports ENABLE ROW LEVEL SECURITY;
-- No policies yet — matches proven pre-05-25 state (zero policies until
-- db_security_hardening's sibling migration, rls_policies, adds one).
