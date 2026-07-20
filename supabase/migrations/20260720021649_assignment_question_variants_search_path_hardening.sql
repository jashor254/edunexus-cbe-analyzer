-- Sprint 9 Slice 1 follow-up — search_path hardening for the 4 functions
-- added in 20260720021344_assignment_question_variants.sql, per the
-- Supabase security advisor's function_search_path_mutable finding (a
-- pre-existing pattern across many functions in this project; fixed here
-- only for the new ones this slice introduced, not a project-wide sweep).

ALTER FUNCTION enforce_assignment_questions_lock() SET search_path = public, pg_temp;
ALTER FUNCTION replace_assignment_questions(uuid, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION enforce_variant_lifecycle_transition() SET search_path = public, pg_temp;
ALTER FUNCTION regenerate_assignment_question_variant(uuid, jsonb) SET search_path = public, pg_temp;
