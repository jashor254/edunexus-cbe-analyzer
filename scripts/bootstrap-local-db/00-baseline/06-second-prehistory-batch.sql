-- 12 more PRE-HISTORY tables, discovered via a systematic query comparing all
-- production public tables against supabase_migrations.schema_migrations'
-- full text (H1M-FIX). schools and classes in particular are foundational
-- Core-domain tables with 40+ and 12+ downstream FK dependents respectively —
-- not peripheral. All reconstructed from current live structure minus the
-- updated_at columns known to be added later by 20260525_performance_indexes.sql
-- where applicable.

CREATE TABLE IF NOT EXISTS public.schools (
  id                             uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  school_name                    text NOT NULL,
  created_by                     uuid,
  created_at                     timestamptz DEFAULT now(),
  nemis_code                     text,
  county                         text,
  school_type                    text DEFAULT 'secondary',
  contact_phone                  text,
  contact_email                  text,
  subscription_tier              text DEFAULT 'free',
  sub_county                     text,
  ward                           text,
  address                        text,
  logo_url                       text,
  motto                          text,
  is_active                      boolean NOT NULL DEFAULT true,
  provisioning_source            text,
  school_entitlement_status      text NOT NULL DEFAULT 'none',
  school_entitlement_expires_at  timestamptz
);

CREATE TABLE IF NOT EXISTS public.classes (
  id                uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  school_id         uuid,
  class_name        text,
  grade             integer,
  stream            text,
  academic_year     integer,
  created_at        timestamptz DEFAULT now(),
  grade_id          uuid,
  stream_id         uuid,
  class_teacher_id  uuid,
  capacity          integer,
  display_name      text,
  academic_year_id  uuid
);

CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid,
  title      text NOT NULL DEFAULT 'New CBC Lesson',
  grade      text,
  subject    text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid,
  role       text,
  content    text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  student_id  uuid,
  message     text NOT NULL,
  response    text NOT NULL,
  subject     text,
  difficulty  integer,
  tokens_used integer DEFAULT 1,
  metadata    jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bulk_upload_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       uuid NOT NULL,
  uploaded_by     uuid NOT NULL,
  upload_type     varchar,
  file_name       varchar,
  total_rows      integer,
  successful_rows integer,
  failed_rows     integer,
  error_log       jsonb,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clinic_reports (
  id                      uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  report_id               varchar UNIQUE,
  student_id              uuid NOT NULL,
  version                 varchar DEFAULT '1.0.0',
  generated_at            timestamptz,
  next_review_date        timestamptz,
  grade                   integer,
  term                    integer,
  year                    integer,
  student_summary         jsonb,
  subjects_summary        jsonb,
  pathway_recommendation  jsonb,
  careers_analysis        jsonb,
  data_completeness       varchar DEFAULT 'complete',
  warnings                text[],
  assessments_count       integer DEFAULT 0,
  oldest_assessment_date  timestamptz,
  newest_assessment_date  timestamptz,
  pdf_generated           boolean DEFAULT false,
  pdf_url                 text,
  pdf_generated_at        timestamptz,
  created_at              timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.capability_history (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          uuid NOT NULL,
  capability_profile  jsonb NOT NULL,
  assessment_count    integer NOT NULL DEFAULT 0,
  computed_at         timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.slide_generations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id   uuid NOT NULL,
  subject      text NOT NULL,
  grade        text NOT NULL,
  topic        text NOT NULL,
  slides_count integer NOT NULL DEFAULT 10,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.learning_compass_state (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id           uuid NOT NULL UNIQUE,
  current_tier         text,
  subject_tiers        jsonb DEFAULT '{}'::jsonb,
  mastered_concepts    text[] DEFAULT '{}',
  struggling_concepts  text[] DEFAULT '{}',
  session_data         jsonb DEFAULT '{}'::jsonb,
  updated_at           timestamptz DEFAULT now(),
  created_at           timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.learning_compass_configs (
  id                       uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  student_id               uuid NOT NULL,
  clinic_report_id         uuid,
  enabled                  boolean DEFAULT true,
  focus_subjects           text[] NOT NULL,
  focus_subjects_display   text[] NOT NULL,
  daily_schedule           text NOT NULL,
  daily_duration_minutes   integer DEFAULT 30,
  target_date              timestamptz NOT NULL,
  expected_improvement     jsonb NOT NULL,
  adaptive_tier            varchar NOT NULL,
  warm_up_minutes          integer DEFAULT 5,
  main_lesson_minutes      integer DEFAULT 15,
  practice_minutes         integer DEFAULT 8,
  review_minutes           integer DEFAULT 2,
  parent_updates           varchar DEFAULT 'weekly',
  active                   boolean DEFAULT true,
  completed                boolean DEFAULT false,
  completed_at             timestamptz,
  created_at               timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.compass_progress (
  id                         uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  student_id                 uuid NOT NULL,
  config_id                  uuid,
  subject                    text NOT NULL,
  subject_display            text NOT NULL,
  baseline_score             numeric,
  current_score              numeric,
  target_score               numeric,
  total_sessions             integer DEFAULT 0,
  total_minutes              integer DEFAULT 0,
  average_accuracy           numeric,
  improvement_rate           numeric,
  velocity_trend             varchar,
  predicted_completion_date  timestamptz,
  on_track                   boolean DEFAULT true,
  weekly_snapshots           jsonb DEFAULT '[]'::jsonb,
  last_session_at            timestamptz,
  updated_at                 timestamptz DEFAULT now(),
  created_at                 timestamptz DEFAULT now()
);
