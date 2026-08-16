-- 9 more PRE-HISTORY tables discovered during H1M-FIX replay: no CREATE TABLE
-- anywhere in repo (loose files or tracked migrations) NOR in production's
-- tracked migration history (verified via supabase_migrations.schema_migrations
-- full-text search). Same class of gap as shared_reports/academic_reports.
-- Reconstructed from current live structure via list_tables, minus updated_at
-- (added by 20260525_performance_indexes.sql for nearly every table — that
-- migration remains responsible for adding it, not this baseline).
-- Not on the direct Evidence-domain dependency path; included only because
-- 20260525_performance_indexes.sql references them for indexing.

CREATE TABLE IF NOT EXISTS public.class_teachers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id   uuid,
  teacher_id uuid REFERENCES auth.users(id),
  subject    varchar,
  role       varchar DEFAULT 'subject_teacher',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.early_access_leads (
  id            uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name          text,
  email         text,
  phone         text,
  plan          text NOT NULL,
  student_grade integer,
  status        text NOT NULL DEFAULT 'interested',
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  activated_at  timestamptz
);

CREATE TABLE IF NOT EXISTS public.kicd_curriculum_lessons (
  id                                uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  substrand_id                      uuid,
  learning_area_id                  uuid,
  grade_id                          uuid,
  topic_specific_learning_outcomes  jsonb,
  learning_experiences              jsonb,
  key_inquiry_questions             jsonb,
  learning_resources                jsonb,
  assessment_methods                jsonb,
  core_competencies                 text,
  values                            text,
  pci_links                         text,
  source_document                   text,
  is_kicd_official                  boolean DEFAULT false,
  confidence_score                  double precision DEFAULT 0.75,
  created_at                        timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.learning_moments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id    uuid NOT NULL,
  concept       text,
  insight       text,
  cognitive_load text,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mpesa_payments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid,
  amount      integer,
  status      text DEFAULT 'pending',
  checkout_id text UNIQUE,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.parent_profiles (
  id                       uuid PRIMARY KEY,
  children_count           integer DEFAULT 0,
  subscription_tier        text DEFAULT 'free',
  subscription_expires_at  timestamptz,
  m_pesa_phone             text,
  preferred_contact_method text DEFAULT 'whatsapp',
  created_at               timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  referral_id   uuid NOT NULL,
  tokens_earned integer NOT NULL,
  reason        text,
  claimed       boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.struggle_patterns (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  subject    text NOT NULL,
  grade      integer NOT NULL,
  term       integer NOT NULL,
  score      numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_guardians (
  id           uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  student_id   uuid,
  guardian_id  uuid,
  relationship text DEFAULT 'parent',
  created_at   timestamptz DEFAULT now()
);
