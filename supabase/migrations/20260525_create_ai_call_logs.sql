-- 20260525_create_ai_call_logs.sql
--
-- lib/ai/logger.ts writes to ai_call_logs in production for cost monitoring.
-- This table was never created — every AI call has been silently failing to log.
-- ai_usage_logs is a separate table (user_id + usage_type only, not detailed).
--
-- Rollback:
--   DROP TABLE IF EXISTS public.ai_call_logs;

BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_call_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  feature     text        NOT NULL,
  model       text        NOT NULL,
  prompt      text,
  response    text,
  latency_ms  integer,
  token_count integer,
  success     boolean     NOT NULL DEFAULT true,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_call_logs_user_id    ON public.ai_call_logs(user_id);
CREATE INDEX idx_ai_call_logs_feature    ON public.ai_call_logs(feature);
CREATE INDEX idx_ai_call_logs_created_at ON public.ai_call_logs(created_at);

-- Service role writes only (logger uses createServiceClient). No client reads.
ALTER TABLE public.ai_call_logs ENABLE ROW LEVEL SECURITY;

COMMIT;
