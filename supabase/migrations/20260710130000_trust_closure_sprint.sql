-- 20260710130000_trust_closure_sprint.sql
--
-- Trust Closure Sprint — closes three confirmed findings from the
-- Engineering Trust Report (2026-07-10), each a small, additive,
-- backward-compatible fix reusing existing conventions already in this
-- migration set. No architecture change, no new tables, no new intelligence.
--
-- 1. learner_evidence.learner_id had no ON DELETE behaviour (default
--    NO ACTION), so a student deletion would raise an unhandled FK
--    violation if any evidence existed for that student. learner_id is
--    already nullable by design ("identity may not resolve" — see
--    20260707_evidence_domain.sql), so ON DELETE SET NULL is the correct,
--    already-established pattern: it's the exact same behaviour already
--    used for intervention_log.student_id and whatsapp_inbound_log.student_id
--    in 20260628_eios_foundation.sql. Evidence rows are never deleted —
--    consistent with the Evidence Domain's immutability invariant — they
--    simply lose their learner linkage, same as those two tables already do.
--
-- 2. ai_call_logs and whatsapp_inbound_log had RLS enabled with either no
--    policy (ai_call_logs) or a service-role-only policy
--    (whatsapp_inbound_log), meaning the data subject could not read their
--    own AI interaction history or their own WhatsApp message even via a
--    self-service request. This adds one additional, purely additive SELECT
--    policy to each table, scoped to the row's own owner. Existing
--    service-role behaviour is unchanged: the service-role client bypasses
--    RLS entirely regardless of policies present, and no existing policy is
--    modified or dropped.
--
-- Rollback:
--   ALTER TABLE learner_evidence DROP CONSTRAINT IF EXISTS learner_evidence_learner_id_fkey;
--   ALTER TABLE learner_evidence ADD CONSTRAINT learner_evidence_learner_id_fkey
--     FOREIGN KEY (learner_id) REFERENCES students(id);
--   DROP POLICY IF EXISTS "ai_call_logs_own_read" ON public.ai_call_logs;
--   DROP POLICY IF EXISTS "whatsapp_inbound_own_read" ON whatsapp_inbound_log;

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. learner_evidence.learner_id → students(id) ON DELETE SET NULL
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE learner_evidence
  DROP CONSTRAINT IF EXISTS learner_evidence_learner_id_fkey;

ALTER TABLE learner_evidence
  ADD CONSTRAINT learner_evidence_learner_id_fkey
  FOREIGN KEY (learner_id) REFERENCES students(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Self-access RLS — data subject can read their own rows
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "ai_call_logs_own_read"
  ON public.ai_call_logs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "whatsapp_inbound_own_read"
  ON whatsapp_inbound_log FOR SELECT
  USING (
    parent_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = whatsapp_inbound_log.student_id AND s.user_id = auth.uid()
    )
  );

COMMIT;
