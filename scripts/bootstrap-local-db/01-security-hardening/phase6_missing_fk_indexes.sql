-- db_security_hardening_phase6_missing_fk_indexes (prod 20260702141932)
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id
  ON public.chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id
  ON public.chat_messages(session_id);

CREATE INDEX IF NOT EXISTS idx_bulk_upload_logs_uploaded_by
  ON public.bulk_upload_logs(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_classes_class_teacher_id
  ON public.classes(class_teacher_id);
CREATE INDEX IF NOT EXISTS idx_classes_school_id
  ON public.classes(school_id);

CREATE INDEX IF NOT EXISTS idx_class_students_parent_id
  ON public.class_students(parent_id);

CREATE INDEX IF NOT EXISTS idx_assessments_user_id
  ON public.assessments(user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_payment_id
  ON public.subscriptions(payment_id);

CREATE INDEX IF NOT EXISTS idx_feature_requests_user_id
  ON public.feature_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_assignment_submissions_class_id
  ON public.assignment_submissions(class_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_compass_session_id
  ON public.assignment_submissions(compass_session_id);

CREATE INDEX IF NOT EXISTS idx_sow_grades_level_id
  ON public.sow_grades(level_id);

CREATE INDEX IF NOT EXISTS idx_student_career_interests_career_id
  ON public.student_career_interests(career_id);
CREATE INDEX IF NOT EXISTS idx_career_review_queue_submitted_by
  ON public.career_review_queue(submitted_by);

CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_parent_node_id
  ON public.knowledge_nodes(parent_node_id);
CREATE INDEX IF NOT EXISTS idx_node_assessment_map_node_id
  ON public.node_assessment_map(node_id);

CREATE INDEX IF NOT EXISTS idx_formative_signals_lesson_plan_id
  ON public.formative_signals(lesson_plan_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_log_parent_id
  ON public.whatsapp_inbound_log(parent_id);

CREATE INDEX IF NOT EXISTS idx_assessment_quality_flags_teacher_id
  ON public.assessment_quality_flags(teacher_id);

CREATE INDEX IF NOT EXISTS idx_school_users_invited_by
  ON public.school_users(invited_by);

CREATE INDEX IF NOT EXISTS idx_learner_promotions_from_class_id
  ON public.learner_promotions(from_class_id);
CREATE INDEX IF NOT EXISTS idx_learner_promotions_to_class_id
  ON public.learner_promotions(to_class_id);
CREATE INDEX IF NOT EXISTS idx_learner_promotions_processed_by
  ON public.learner_promotions(processed_by);
CREATE INDEX IF NOT EXISTS idx_learner_transfers_processed_by
  ON public.learner_transfers(processed_by);

CREATE INDEX IF NOT EXISTS idx_eils_reasoning_log_recommendation_id
  ON public.eils_reasoning_log(recommendation_id);

CREATE INDEX IF NOT EXISTS idx_eir_findings_hypothesis_id
  ON public.eir_findings(hypothesis_id);
