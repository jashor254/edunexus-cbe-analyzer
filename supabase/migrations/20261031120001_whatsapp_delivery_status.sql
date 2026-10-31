-- 20261031120001_whatsapp_delivery_status.sql
-- Adds delivery-status tracking columns to notification_log so outbound
-- WhatsApp messages can be tracked from API-accepted through delivered/read/failed.
-- Meta sends status callbacks via webhook; without these columns the application
-- can only record "Meta accepted the API call" — not whether the parent received it.

ALTER TABLE notification_log
  ADD COLUMN IF NOT EXISTS delivery_status     TEXT,
  ADD COLUMN IF NOT EXISTS delivery_status_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_error_code TEXT;

CREATE INDEX IF NOT EXISTS idx_notification_log_whatsapp_msg_id
  ON notification_log (whatsapp_message_id)
  WHERE whatsapp_message_id IS NOT NULL;
