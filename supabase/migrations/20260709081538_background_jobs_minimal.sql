-- 20260709081538_background_jobs_minimal.sql
--
-- Minimal, self-contained background-jobs schema (job_queues / jobs /
-- job_logs) — needed by lib/repositories/job.repository.ts and
-- lib/jobs/*, which already existed in the codebase and assumed these
-- tables were live. They were drafted as part of supabase/migrations/
-- 20260701_phase8_platform_foundation.sql (Phase 8 platform foundation:
-- organizations, billing, event bus, job queue, audit logs, API keys) but
-- that migration was never applied to this project — confirmed via
-- `list_migrations` and by `organizations`/`is_org_admin` not existing.
--
-- This migration pulls out ONLY the background-jobs slice (phase 8.5 of
-- that file) rather than applying all 913 lines of unrelated multi-tenant
-- platform schema, which is out of scope for the pilot-readiness hotfix
-- sprint that needs this table (HOTFIX 2/3: live progress + reconnect for
-- long-running AI batch generation — Holiday Planner, class report
-- generation). The `organization_id` column and its admin-read RLS policy
-- are dropped from the original design since `organizations` doesn't exist
-- here; every other column matches lib/jobs/types.ts's JobRecord exactly so
-- the existing repository code needs no changes.
--
-- public.set_updated_at() already exists (added by the 2026-07-02 security
-- hardening migrations) — reused here, not redefined, so as not to touch
-- the 5 live Developer Portal tables that already trigger off it.

-- ── job_queues ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS job_queues (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL UNIQUE,
  description     text,
  concurrency     int         NOT NULL DEFAULT 1,
  max_retries     int         NOT NULL DEFAULT 3,
  timeout_ms      int         NOT NULL DEFAULT 30000,
  is_active       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

INSERT INTO job_queues (name, description, concurrency, max_retries, timeout_ms) VALUES
  ('ai.generation',       'AI content generation (SOW, lessons, assessments, holiday plans, reports)', 3, 2, 120000),
  ('report.generation',   'PDF report generation',                             5, 3, 60000),
  ('data.import',         'Bulk data imports',                                 2, 3, 300000),
  ('data.export',         'Bulk data exports',                                 2, 3, 300000),
  ('email.send',          'Transactional email delivery',                      10, 5, 10000),
  ('whatsapp.send',       'WhatsApp message delivery',                         5, 5, 15000),
  ('analytics.aggregate', 'Analytics aggregation jobs',                        2, 3, 600000),
  ('webhook.deliver',     'Outbound webhook delivery',                         10, 5, 10000)
ON CONFLICT (name) DO NOTHING;

-- Operational config, not tenant data — read/managed only by backend job
-- processing via the service-role client, which bypasses RLS regardless.
-- No policies: default-deny for anon/authenticated (Supabase grants full
-- CRUD to those roles on every new table by default, so RLS must be
-- enabled even with zero end-user access needed).
ALTER TABLE job_queues ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON job_queues
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── jobs ─────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE job_status AS ENUM (
    'queued', 'processing', 'completed', 'failed', 'canceled', 'dead_letter'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS jobs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_name      text        NOT NULL REFERENCES job_queues(name),
  organization_id uuid,       -- kept for JobRecord type parity; no `organizations` table exists in this project, so no FK
  user_id         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  type            text        NOT NULL,       -- 'ai.sow.generate', 'ai.holiday_plan.generate', 'ai.class_reports.generate'
  status          job_status  NOT NULL DEFAULT 'queued',
  priority        int         NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  payload         jsonb       NOT NULL DEFAULT '{}',
  result          jsonb,
  error_message   text,
  attempt_count   int         NOT NULL DEFAULT 0,
  max_attempts    int         NOT NULL DEFAULT 3,
  scheduled_at    timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  idempotency_key text        UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_queue_name      ON jobs (queue_name, status, priority DESC, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id         ON jobs (user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status          ON jobs (status);
CREATE INDEX IF NOT EXISTS idx_jobs_type            ON jobs (type);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_at    ON jobs (scheduled_at) WHERE status = 'queued';

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jobs_user_read" ON jobs;
CREATE POLICY "jobs_user_read"
  ON jobs FOR SELECT
  USING (user_id = auth.uid());

CREATE TRIGGER set_updated_at BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── job_logs ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS job_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  attempt     int         NOT NULL DEFAULT 1,
  level       text        NOT NULL DEFAULT 'info' CHECK (level IN ('debug','info','warn','error')),
  message     text        NOT NULL,
  data        jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_logs_job_id     ON job_logs (job_id);
CREATE INDEX IF NOT EXISTS idx_job_logs_created_at ON job_logs (created_at DESC);

ALTER TABLE job_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "job_logs_user_read" ON job_logs;
CREATE POLICY "job_logs_user_read"
  ON job_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = job_logs.job_id AND j.user_id = auth.uid()
    )
  );

-- ── queue_depth view (used by JobRepository.findQueueDepths / admin monitoring) ──

CREATE OR REPLACE VIEW queue_depth
WITH (security_invoker = true) AS
SELECT
  queue_name,
  count(*) FILTER (WHERE status = 'queued')      AS queued,
  count(*) FILTER (WHERE status = 'processing')  AS processing,
  count(*) FILTER (WHERE status = 'failed')      AS failed,
  count(*) FILTER (WHERE status = 'dead_letter') AS dead_letter,
  min(scheduled_at) FILTER (WHERE status = 'queued') AS oldest_queued_at
FROM jobs
GROUP BY queue_name;
