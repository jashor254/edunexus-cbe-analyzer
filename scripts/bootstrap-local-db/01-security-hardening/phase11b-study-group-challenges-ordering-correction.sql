-- Ordering correction, not a new historical event.
--
-- In true production chronology, db_security_hardening_phase11
-- (20260702162507) created policy "service_role_insert_challenges" on
-- study_group_challenges, and THEN a later tracked migration,
-- 20260710104828_sprint14_security_hardening.sql, did a blanket
-- `DROP POLICY IF EXISTS` over every policy on study_group_challenges (among
-- other tables) and deliberately did NOT recreate any INSERT policy --
-- service_role bypasses RLS entirely, so none is needed; see that
-- migration's own PART 1 comment for the explicit rationale.
--
-- This bootstrap applies all tracked migrations (STAGE 2, includes sprint14)
-- before the recovered security-hardening phases (STAGE 3, includes
-- phase11), which is the REVERSE of true chronological order. Left
-- uncorrected, phase11's CREATE POLICY runs last and resurrects a policy
-- production does not have. This statement re-applies sprint14's outcome
-- after phase11, restoring the true final production state: exactly one
-- policy on study_group_challenges ("study_group_challenges: member read",
-- SELECT only).
--
-- Verified against live production 2026-08-16: pg_policies for
-- study_group_challenges returns exactly one row.

DROP POLICY IF EXISTS "service_role_insert_challenges" ON public.study_group_challenges;

-- Second, independent ordering bug: "20260710120000_sprint15_corrections.sql"
-- sorts LEXICOGRAPHICALLY BEFORE "20260710_sprint14_security_hardening.sql"
-- (ASCII '1' < '_'), even though sprint15 happened chronologically AFTER
-- sprint14 in production (112718 vs 104828, same day). `ls | sort`-driven
-- STAGE 2 therefore applies sprint15 first, then sprint14 -- and sprint14's
-- blanket `DROP POLICY` + recreate-with-inline-expression clobbers sprint15's
-- auth_is_group_member(group_id) fix. Restoring the true final expression
-- here, verified against live production 2026-08-16
-- (pg_policies.qual = 'auth_is_group_member(group_id)').

DROP POLICY IF EXISTS "study_group_challenges: member read" ON public.study_group_challenges;
CREATE POLICY "study_group_challenges: member read"
  ON public.study_group_challenges FOR SELECT
  USING (public.auth_is_group_member(group_id));
