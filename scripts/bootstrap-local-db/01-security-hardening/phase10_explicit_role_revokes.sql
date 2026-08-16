-- db_security_hardening_phase10_explicit_role_revokes (prod 20260702143705)
-- Verbatim recovered SQL.

REVOKE EXECUTE ON FUNCTION public.auth_is_guardian_of(uuid)       FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_is_teacher_of_student(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_owns_student(uuid)          FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_teacher_id()                FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin()                       FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_subscription_active(uuid)  FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_grade_topics(integer, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_learner_dashboard_stats(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_referral_stats(uuid)          FROM anon;

REVOKE EXECUTE ON FUNCTION public.add_tokens(uuid, integer)
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.deduct_tokens(uuid, integer)
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.deduct_tokens(uuid, text, integer, jsonb)
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.deduct_ai_token(uuid, text)
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.deduct_ai_token(text, text)
  FROM anon, authenticated, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.upgrade_to_termly(uuid)
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.use_free_analysis(uuid)
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_successful_payment_webhook(uuid, text, text, text, integer, numeric, jsonb, text)
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.create_user_with_referral(text, text, text)
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.devportal_record_request(uuid, uuid, text, text, integer, integer, integer, text, text)
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.expire_free_analyses()
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.increment_beta_teacher_count()
  FROM anon, authenticated;
