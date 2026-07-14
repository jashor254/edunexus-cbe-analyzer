-- ═══════════════════════════════════════════════════════════════════════════════
-- Sprint 14 — Platform Security & Production Hardening
-- 2026-07-10
--
-- PART 1 — Study Group lockdown. Confirmed via audit: study_groups,
-- study_group_members, study_group_challenges, study_group_answers all carry
-- a `USING (true)` SELECT policy in production (schema for these tables is
-- untracked in migrations — added directly against the live DB — so this
-- migration is also the first tracked record of their RLS). Any authenticated
-- user could read every group's roster, every member's points, and — most
-- seriously — every challenge's `correct_answer` directly, bypassing the
-- answer-checking logic in app/api/groups/challenge/route.ts entirely.
--
-- PART 2 — class_students and student_alerts. class_students carries
-- `USING (true)` for SELECT (defined in supabase/teacher_portal_migration.sql),
-- exposing every school's roster + parent_id linkage to any authenticated
-- user. student_alerts has RLS enabled but only a teacher-read policy — no
-- parent-read policy exists at all, so the parent alerts route
-- (app/api/parent/alerts/route.ts) only works today because it uses the
-- service-role client, which bypasses RLS. Both are hardened here to the
-- minimum access the application already assumes.
--
-- This migration ONLY replaces permissive/missing policies with the minimum
-- required. It does not touch table shape, does not add new tables, and does
-- not change any intelligence-domain table (Evidence/Projection/Blueprint/
-- Career/Adaptive Learning/Parent Intelligence/Teacher Intelligence/Holiday/
-- Knowledge Graph/Recommendation Engine are untouched).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 1 — STUDY GROUPS
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop every existing policy on these four tables, whatever they're named —
-- the audit found `qual: true` policies in production under names this
-- migration cannot know in advance, since the tables themselves are untracked.
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE tablename IN ('study_groups', 'study_group_members', 'study_group_challenges', 'study_group_answers')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

ALTER TABLE study_groups            ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_group_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_group_challenges  ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_group_answers     ENABLE ROW LEVEL SECURITY;

-- study_groups: readable only by members (checked via student_id OR user_id,
-- matching the dual-key membership model app/api/groups/join/route.ts writes).
-- No client-side path ever looks a group up by invite_code before joining —
-- that lookup happens server-side via the service client in
-- app/api/groups/join/route.ts, so it is unaffected by this restriction.
CREATE POLICY "study_groups: member read"
  ON study_groups FOR SELECT
  USING (
    id IN (
      SELECT group_id FROM study_group_members
      WHERE user_id = auth.uid()
         OR student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
    )
  );

-- study_group_members: a member can see the roster of groups they belong to —
-- not every group's roster.
CREATE POLICY "study_group_members: fellow member read"
  ON study_group_members FOR SELECT
  USING (
    group_id IN (
      SELECT sgm2.group_id FROM study_group_members sgm2
      WHERE sgm2.user_id = auth.uid()
         OR sgm2.student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
    )
  );

-- study_group_challenges: a member can see today's/past challenges for their
-- own groups. Row-level access alone is not enough here — see the column-level
-- revoke below, which is the actual fix for the correct_answer leak.
CREATE POLICY "study_group_challenges: member read"
  ON study_group_challenges FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM study_group_members
      WHERE user_id = auth.uid()
         OR student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
    )
  );

-- study_group_answers: a member can see only their own answer record. No
-- client-side page queries any other member's answer — both group-detail
-- pages filter `.eq('user_id', user.id)` already.
CREATE POLICY "study_group_answers: own read"
  ON study_group_answers FOR SELECT
  USING (user_id = auth.uid());

-- The actual answer-leak fix: correct_answer must never be readable by
-- anon/authenticated, regardless of row-level policy. Every real read of this
-- column happens through app/api/groups/challenge/route.ts on the
-- service-role client, which is unaffected by a column-level REVOKE against
-- anon/authenticated.
REVOKE SELECT (correct_answer) ON TABLE study_group_challenges FROM authenticated, anon;

-- No authenticated-role write policies are added for any of the four tables —
-- every INSERT/UPDATE in the live app (create/join/answer/points update) goes
-- through a service-role-backed API route already (app/api/groups/create,
-- app/api/groups/join, app/api/groups/challenge). Omitting a write policy for
-- `authenticated` is the minimum required, not an oversight.

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 2 — class_students (roster) and student_alerts (parent read)
-- ─────────────────────────────────────────────────────────────────────────────

-- class_students previously had `USING (true)` for SELECT (teacher_portal_
-- migration.sql), exposing every school's full roster + parent_id linkage to
-- any authenticated user. No client-side (.tsx) code was found querying this
-- table directly — every read goes through a server route on the service
-- client — so this is a defense-in-depth fix, not a fix for an actively
-- exploited path, same category as the student_alerts gap below.
DROP POLICY IF EXISTS "class_students: read" ON class_students;

CREATE POLICY "class_students: owner read"
  ON class_students FOR SELECT
  USING (
    -- the student themself
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
    -- the linked parent
    OR parent_id = auth.uid()
    -- the owning teacher
    OR class_id IN (
      SELECT id FROM teacher_classes
      WHERE teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
    )
  );

-- student_alerts has RLS enabled but only a teacher-read policy — there is no
-- parent-read policy at all. app/api/parent/alerts/route.ts only works today
-- via the service-role client. Adding the policy the application logic
-- already assumes (student_id reachable via class_students.parent_id, the
-- same join that route performs manually) so a future switch to the
-- RLS-bound client does not silently return empty results.
CREATE POLICY "alerts: parent read"
  ON student_alerts FOR SELECT
  USING (
    student_id IN (
      SELECT student_id FROM class_students WHERE parent_id = auth.uid()
    )
  );
