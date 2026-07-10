-- Unified teacher attention feed: lets a teacher dismiss/snooze a surfaced
-- item (from EILS, Monday panel, weekly intelligence, or student alerts)
-- without touching the underlying source system.

CREATE TABLE IF NOT EXISTS attention_feed_dismissals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id    uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  item_key      text NOT NULL,
  dismissed_at  timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_attention_feed_dismissals_teacher_id
  ON attention_feed_dismissals (teacher_id);

ALTER TABLE attention_feed_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own attention feed dismissals"
  ON attention_feed_dismissals FOR ALL
  USING (teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid()))
  WITH CHECK (teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid()));
