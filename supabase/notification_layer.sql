-- notification_layer.sql
-- Parent-teacher notification layer: notification log, class invites,
-- parent email prefs, work_text on submissions.

-- 1. Parent email + notification prefs on students
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS parent_email TEXT,
  ADD COLUMN IF NOT EXISTS notification_email BOOLEAN DEFAULT true;

-- 2. Notification log — prevents duplicate sends, provides audit trail
CREATE TABLE IF NOT EXISTS notification_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id),
  type            TEXT NOT NULL,
  -- 'assignment_marked' | 'alert_created' | 'invite_sent'
  reference_id    UUID NOT NULL,
  -- assignment_submission id or student_alert id
  sent_at         TIMESTAMPTZ DEFAULT NOW(),
  email_address   TEXT,
  success         BOOLEAN DEFAULT false,
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_reference
  ON notification_log (type, reference_id);

CREATE INDEX IF NOT EXISTS idx_notification_log_user
  ON notification_log (user_id);

-- 3. Class invite links
CREATE TABLE IF NOT EXISTS class_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    UUID REFERENCES teacher_classes(id) ON DELETE CASCADE,
  teacher_id  UUID REFERENCES teachers(id),
  invite_code TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex'),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  used_count  INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_class_invites_code ON class_invites (invite_code);
CREATE INDEX IF NOT EXISTS idx_class_invites_class ON class_invites (class_id);

-- 4. work_text on submissions (student-submitted work body)
ALTER TABLE assignment_submissions
  ADD COLUMN IF NOT EXISTS work_text TEXT;

-- RLS
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_invites ENABLE ROW LEVEL SECURITY;

-- Service role has full access to notification_log (used by server-side email sender)
CREATE POLICY "Service role full access to notification_log"
  ON notification_log FOR ALL
  USING (true)
  WITH CHECK (true);

-- Teachers manage their own class invites
CREATE POLICY "Teachers manage own invites"
  ON class_invites FOR ALL
  USING (
    teacher_id = (
      SELECT id FROM teachers WHERE user_id = auth.uid()
    )
  );
