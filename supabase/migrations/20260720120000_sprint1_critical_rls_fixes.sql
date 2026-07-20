-- ═══════════════════════════════════════════════════════════════════════════════
-- Sprint 1 — Critical RLS Fixes (Platform Audit v1.0, Blockers #1 and #2)
-- 2026-07-20
--
-- PART 1 — token_balances self-grant. The "own update" policy has no
-- WITH CHECK, so any authenticated user can PATCH their own token_balances
-- row to an arbitrary value directly via PostgREST. The one legitimate app
-- code path that relied on this (app/api/payments/verify/route.ts, which ran
-- its token_balances write on the user's own session client rather than the
-- service client its sibling app/api/payments/callback/route.ts already
-- uses) is fixed in the same commit as this migration. deduct_tokens() and
-- the referral/grant SECURITY DEFINER functions are unaffected — they run as
-- the function owner and bypass RLS regardless of policy.
--
-- PART 2 — learner_evidence access-control anti-pattern. The existing
-- `learner_evidence_own_teacher` policy (FOR ALL) gates access by who
-- *entered* the record (ingestion_runs.initiated_by / teacher_id) rather
-- than who *currently teaches* the learner — the exact anti-pattern
-- CLAUDE.md's Architecture Rules section forbids explicitly. No application
-- code relies on this policy today: every real read/write of learner_evidence
-- goes through lib/repositories/evidence.repository.ts (service-role client,
-- confirmed via lib/repositories/base.ts) or lib/intelligence/evidenceLifecycle.ts.
-- This is a defense-in-depth fix, same category as Sprint 14's class_students/
-- student_alerts hardening — replaced with a SELECT-only policy matching the
-- ownership modes lib/compass/ownership.ts already treats as legitimate:
-- teacher via direct students.teacher_id OR class_students roster, parent via
-- students.parent_user_id (canonical, per resolveParentOwnership) OR
-- class_students.parent_id (the mechanism Sprint 14 used for student_alerts —
-- kept for symmetry; the two parent-linkage columns are themselves schema
-- drift worth its own future audit item, not resolved here).
--
-- This migration ONLY replaces incorrect/missing policies with the minimum
-- correct access. It does not touch table shape, does not add new tables,
-- and does not change any other intelligence-domain table.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (kept here per this repo's convention — not executed by this file)
-- ─────────────────────────────────────────────────────────────────────────────
-- DROP POLICY IF EXISTS "token_balances: current teacher or parent read" ON token_balances; -- n/a, no new read policy added
-- CREATE POLICY "token_balances: own update" ON token_balances FOR UPDATE USING (auth.uid() = user_id);
--
-- DROP POLICY IF EXISTS "learner_evidence: current teacher or parent read" ON learner_evidence;
-- CREATE POLICY "learner_evidence_own_teacher"
--   ON learner_evidence FOR ALL
--   USING (
--     EXISTS (
--       SELECT 1 FROM ingestion_runs ir
--       WHERE ir.id = learner_evidence.ingestion_run_id
--         AND (ir.initiated_by = auth.uid()
--              OR EXISTS (SELECT 1 FROM teachers t WHERE t.id = ir.teacher_id AND t.user_id = auth.uid()))
--     )
--   );

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 1 — token_balances
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "token_balances: own update" ON token_balances;

-- No replacement authenticated-role UPDATE policy. Every legitimate write goes
-- through deduct_tokens() / grant functions (SECURITY DEFINER, bypass RLS as
-- the function owner) or a service-role-backed API route — same pattern
-- already established for study_group_challenges in Sprint 14.

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 2 — learner_evidence
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "learner_evidence_own_teacher" ON learner_evidence;

CREATE POLICY "learner_evidence: current teacher or parent read"
  ON learner_evidence FOR SELECT
  USING (
    -- teacher: direct link (students.teacher_id) — matches
    -- lib/compass/ownership.ts resolveTeacherOwnership's 'teacher_direct' mode
    learner_id IN (
      SELECT s.id FROM students s
      JOIN teachers t ON t.id = s.teacher_id
      WHERE t.user_id = auth.uid()
    )
    -- teacher: class-roster membership — matches resolveTeacherOwnership's
    -- 'teacher_roster' mode
    OR learner_id IN (
      SELECT cs.student_id FROM class_students cs
      JOIN teacher_classes tc ON tc.id = cs.class_id
      JOIN teachers t ON t.id = tc.teacher_id
      WHERE t.user_id = auth.uid()
    )
    -- parent: students.parent_user_id — matches resolveParentOwnership
    OR learner_id IN (SELECT id FROM students WHERE parent_user_id = auth.uid())
    -- parent: class_students.parent_id — the linkage Sprint 14 used for
    -- student_alerts; kept for symmetry with that precedent
    OR learner_id IN (SELECT student_id FROM class_students WHERE parent_id = auth.uid())
  );

-- No authenticated-role INSERT/UPDATE/DELETE policy. Every real write goes
-- through lib/intelligence/evidenceLifecycle.ts on the service-role client.
