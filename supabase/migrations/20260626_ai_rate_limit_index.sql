-- 20260626_ai_rate_limit_index.sql
--
-- Composite index for the checkDailyCallLimit() query in lib/ai/rateLimit.ts.
-- Without this, daily rate-limit checks do a seq-scan on ai_call_logs per request.
-- (user_id, feature, success, created_at DESC) covers all four WHERE / ORDER clauses.
--
-- Rollback:
--   DROP INDEX IF EXISTS idx_ai_call_logs_rate_limit;

BEGIN;

CREATE INDEX IF NOT EXISTS idx_ai_call_logs_rate_limit
  ON public.ai_call_logs(user_id, feature, success, created_at DESC);

COMMIT;
