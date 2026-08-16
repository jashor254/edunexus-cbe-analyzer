-- Recovered from production migration 20260327105501_create_shared_reports
-- (H1M-R2, exact statement text via supabase_migrations.schema_migrations)
CREATE TABLE IF NOT EXISTS public.shared_reports (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  token        text        NOT NULL UNIQUE,
  student_id   uuid        NOT NULL REFERENCES public.students(id),
  user_id      uuid        NOT NULL REFERENCES auth.users(id),
  student_name text        NOT NULL,
  grade        text        NOT NULL,
  report_data  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  expires_at   timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_reports_student_id ON public.shared_reports(student_id);
CREATE INDEX IF NOT EXISTS idx_shared_reports_user_id ON public.shared_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_reports_token ON public.shared_reports(token);

ALTER TABLE public.shared_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read shared reports"
  ON public.shared_reports FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own shared reports"
  ON public.shared_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shared reports"
  ON public.shared_reports FOR DELETE
  USING (auth.uid() = user_id);
