-- 20260520000000_whatsapp_layer.sql
-- Adds WhatsApp notification support:
--   • notification_log gets channel, phone_number, whatsapp_message_id
--   • dedup index becomes channel-scoped
--   • students gets parent_phone, notification_whatsapp, opt-in columns
--   • new whatsapp_opt_ins audit table

-- ─── 1. Patch notification_log ────────────────────────────────────────────────

ALTER TABLE notification_log
  ADD COLUMN IF NOT EXISTS channel              TEXT DEFAULT 'email'
    CHECK (channel IN ('whatsapp', 'email')),
  ADD COLUMN IF NOT EXISTS phone_number         TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_message_id  TEXT;

-- Back-fill channel for all existing rows (they were all email sends)
UPDATE notification_log
  SET channel = 'email'
  WHERE channel IS NULL;

-- Replace non-channel-scoped dedup index with a channel-scoped one.
-- The old index was on (type, reference_id) without channel.
DROP INDEX IF EXISTS notification_log_dedup;
DROP INDEX IF EXISTS idx_notification_log_reference;

CREATE UNIQUE INDEX IF NOT EXISTS notification_log_dedup
  ON notification_log (type, reference_id, channel)
  WHERE success = true;

-- Recreate the general lookup index that was dropped above
CREATE INDEX IF NOT EXISTS idx_notification_log_reference
  ON notification_log (type, reference_id);

-- ─── 2. Patch students table ──────────────────────────────────────────────────

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS parent_phone          TEXT,
  ADD COLUMN IF NOT EXISTS notification_whatsapp BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_opted_in     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_opted_in_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS parent_first_name     TEXT;

-- ─── 3. whatsapp_opt_ins audit table ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS whatsapp_opt_ins (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID        REFERENCES students(id) ON DELETE CASCADE,
  parent_phone TEXT        NOT NULL,
  opted_in_at  TIMESTAMPTZ DEFAULT NOW(),
  opted_out_at TIMESTAMPTZ,
  source       TEXT        DEFAULT 'dashboard_prompt',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE whatsapp_opt_ins ENABLE ROW LEVEL SECURITY;

-- Parents can read their own opt-in records
CREATE POLICY "Parents see own optin records"
  ON whatsapp_opt_ins FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students
      WHERE user_id = auth.uid()
    )
  );

-- Service role has full access (used by server-side opt-in route)
CREATE POLICY "Service role full access optin"
  ON whatsapp_opt_ins FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_whatsapp_opt_ins_student
  ON whatsapp_opt_ins (student_id);
