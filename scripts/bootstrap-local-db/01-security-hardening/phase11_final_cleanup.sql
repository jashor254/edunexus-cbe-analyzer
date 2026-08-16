-- db_security_hardening_phase11_final_cleanup (prod 20260702162507)
-- Verbatim recovered SQL.

REVOKE EXECUTE ON FUNCTION public.check_subscription_active(uuid)  FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_learner_dashboard_stats(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_referral_stats(uuid)          FROM authenticated;

DROP POLICY IF EXISTS "Authenticated users can create challenges" ON public.study_group_challenges;

CREATE POLICY "service_role_insert_challenges" ON public.study_group_challenges
  FOR INSERT TO service_role WITH CHECK (true);
