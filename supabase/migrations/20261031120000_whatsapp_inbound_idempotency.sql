-- 20261031120000_whatsapp_inbound_idempotency.sql
-- Adds a meta_message_id column to whatsapp_inbound_log for webhook
-- deduplication. Meta may deliver the same event more than once; without
-- a unique constraint on the provider message ID, duplicate deliveries
-- create duplicate learner observations.

ALTER TABLE whatsapp_inbound_log
  ADD COLUMN IF NOT EXISTS meta_message_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_inbound_meta_message_id
  ON whatsapp_inbound_log (meta_message_id)
  WHERE meta_message_id IS NOT NULL;
