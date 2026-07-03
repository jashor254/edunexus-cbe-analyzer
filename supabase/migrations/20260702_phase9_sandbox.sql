-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 9.4 — SANDBOX ENVIRONMENT
-- Adds the environment abstraction to the platform layer.
-- Affects: api_keys, usage_events
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. api_keys — add environment column ─────────────────────────────────────

ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'live'
    CONSTRAINT api_keys_environment_check CHECK (environment IN ('live', 'sandbox'));

CREATE INDEX IF NOT EXISTS idx_api_keys_environment
  ON api_keys (environment);

-- ── 2. usage_events — add environment column ─────────────────────────────────
-- Allows quota enforcement, analytics, and billing to filter by environment
-- without joining api_keys on every query.

ALTER TABLE usage_events
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'live'
    CONSTRAINT usage_events_environment_check CHECK (environment IN ('live', 'sandbox'));

CREATE INDEX IF NOT EXISTS idx_usage_events_environment
  ON usage_events (environment);

-- Composite index: org + environment + event_type + recorded_at
-- Covers the daily quota check query pattern used by enforceQuota().
CREATE INDEX IF NOT EXISTS idx_usage_events_quota_lookup
  ON usage_events (organization_id, environment, event_type, recorded_at DESC);
