-- db_security_hardening_phase9_function_execute_grants (prod 20260702142535)
-- Verbatim recovered SQL.

REVOKE EXECUTE ON FUNCTION public.add_tokens(uuid, integer)                        FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.add_tokens(uuid, integer)                        TO service_role;

REVOKE EXECUTE ON FUNCTION public.deduct_tokens(uuid, integer)                     FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.deduct_tokens(uuid, integer)                     TO service_role;

REVOKE EXECUTE ON FUNCTION public.deduct_tokens(uuid, text, integer, jsonb)        FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.deduct_tokens(uuid, text, integer, jsonb)        TO service_role;

REVOKE EXECUTE ON FUNCTION public.deduct_ai_token(uuid, text)                      FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.deduct_ai_token(uuid, text)                      TO service_role;

REVOKE EXECUTE ON FUNCTION public.handle_successful_payment_webhook(uuid, text, text, text, integer, numeric, jsonb, text)
  FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.handle_successful_payment_webhook(uuid, text, text, text, integer, numeric, jsonb, text)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.upgrade_to_termly(uuid)                          FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.upgrade_to_termly(uuid)                          TO service_role;

REVOKE EXECUTE ON FUNCTION public.use_free_analysis(uuid)                          FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.use_free_analysis(uuid)                          TO service_role;

REVOKE EXECUTE ON FUNCTION public.create_user_with_referral(text, text, text)      FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_user_with_referral(text, text, text)      TO service_role;

REVOKE EXECUTE ON FUNCTION public.devportal_record_request(uuid, uuid, text, text, integer, integer, integer, text, text)
  FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.devportal_record_request(uuid, uuid, text, text, integer, integer, integer, text, text)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_marked_users()                           FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cleanup_marked_users()                           TO service_role;

REVOKE EXECUTE ON FUNCTION public.mark_users_for_deletion()                        FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mark_users_for_deletion()                        TO service_role;

REVOKE EXECUTE ON FUNCTION public.expire_free_analyses()                           FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.expire_free_analyses()                           TO service_role;

REVOKE EXECUTE ON FUNCTION public.increment_beta_teacher_count()                   FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.increment_beta_teacher_count()                   TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_referral_stats(uuid)                         FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_referral_stats(uuid)                         TO service_role;

REVOKE EXECUTE ON FUNCTION public.auth_is_teacher_of_student(uuid)                 FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.auth_is_teacher_of_student(uuid)                 TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.auth_owns_student(uuid)                          FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.auth_owns_student(uuid)                          TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.auth_teacher_id()                                FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.auth_teacher_id()                                TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.auth_is_guardian_of(uuid)                        FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.auth_is_guardian_of(uuid)                        TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_admin()                                       FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_admin()                                       TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.check_subscription_active(uuid)                  FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_subscription_active(uuid)                  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user()                                FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_ultimate()                       FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_developer()                           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.initialize_new_user()                            FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.get_grade_topics(integer, integer, text)         FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_grade_topics(integer, integer, text)         TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_learner_dashboard_stats(uuid)                FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_learner_dashboard_stats(uuid)                TO authenticated, service_role;
