-- PROMOTED MINIMUM DEPENDENCY, not a full devportal bootstrap.
-- db_security_hardening_phase4 (ALTER VIEW ... security_invoker) requires
-- these 5 views to already exist. Their real origin is the devportal-adjacent
-- migration phase4_api_views_and_indexes (prod 20260701040942), which is
-- otherwise deferred as SEPARATE-DOMAIN/DEEP-IRRELEVANT (H1M-R2). Per H1M-FIX
-- §17: security posture outranks domain-scope convenience — promoting just
-- the view definitions, not the rest of that migration's devportal indexes.
CREATE OR REPLACE VIEW v_api_subjects AS
SELECT
  sla.id,
  sla.name,
  sla.short_name,
  sla.order_index                 AS subject_order,
  sg.id                           AS grade_id,
  sg.name                         AS grade,
  sg.numeric_grade,
  sg.order_index                  AS grade_order,
  sl.id                           AS level_id,
  sl.name                         AS level,
  sl.curriculum_type              AS curriculum,
  sl.order_index                  AS level_order
FROM sow_learning_areas sla
JOIN sow_grades  sg ON sg.id = sla.grade_id
JOIN sow_levels  sl ON sl.id = sg.level_id;

CREATE OR REPLACE VIEW v_api_strands AS
SELECT
  ss.id,
  ss.title,
  ss.order_index,
  sla.id                          AS subject_id,
  sla.name                        AS subject,
  sla.short_name                  AS subject_short,
  sg.name                         AS grade,
  sg.numeric_grade,
  sg.order_index                  AS grade_order,
  sl.curriculum_type              AS curriculum,
  sl.name                         AS level,
  sl.order_index                  AS level_order
FROM sow_strands ss
JOIN sow_learning_areas sla ON sla.id = ss.learning_area_id
JOIN sow_grades          sg ON sg.id  = sla.grade_id
JOIN sow_levels          sl ON sl.id  = sg.level_id;

CREATE OR REPLACE VIEW v_api_substrands AS
SELECT
  sub.id,
  sub.title,
  sub.suggested_lessons,
  sub.order_index,
  ss.id                           AS strand_id,
  ss.title                        AS strand_title,
  sla.id                          AS subject_id,
  sla.name                        AS subject,
  sla.short_name                  AS subject_short,
  sg.name                         AS grade,
  sg.numeric_grade,
  sg.order_index                  AS grade_order,
  sl.curriculum_type              AS curriculum,
  sl.name                         AS level,
  sl.order_index                  AS level_order
FROM sow_substrands sub
JOIN sow_strands        ss  ON ss.id  = sub.strand_id
JOIN sow_learning_areas sla ON sla.id = ss.learning_area_id
JOIN sow_grades          sg ON sg.id  = sla.grade_id
JOIN sow_levels          sl ON sl.id  = sg.level_id;

CREATE OR REPLACE VIEW v_api_learning_outcomes AS
SELECT
  slo.id,
  slo.outcome,
  slo.outcome_type,
  slo.order_index,
  sub.id                          AS substrand_id,
  sub.title                       AS substrand_title,
  ss.id                           AS strand_id,
  ss.title                        AS strand_title,
  sla.id                          AS subject_id,
  sla.name                        AS subject,
  sg.name                         AS grade,
  sg.numeric_grade,
  sl.curriculum_type              AS curriculum,
  sl.name                         AS level
FROM sow_learning_outcomes slo
JOIN sow_substrands     sub ON sub.id = slo.substrand_id
JOIN sow_strands         ss ON ss.id  = sub.strand_id
JOIN sow_learning_areas sla ON sla.id = ss.learning_area_id
JOIN sow_grades          sg ON sg.id  = sla.grade_id
JOIN sow_levels          sl ON sl.id  = sg.level_id;

CREATE OR REPLACE VIEW v_api_careers AS
SELECT
  id,
  slug,
  title,
  category,
  difficulty,
  kenya_demand,
  risk_level,
  pathway,
  saturation_note,
  time_to_income_years,
  (ai_impact->>'level')           AS ai_impact_level,
  (ai_impact->>'honest_summary')  AS ai_impact_summary,
  (ai_impact->'creating')         AS ai_impact_creating,
  (ai_impact->'replacing')        AS ai_impact_replacing,
  salary_range_kes,
  required_subjects,
  kcse_minimum,
  cost_to_qualify,
  kenya_market_outlook,
  doors,
  future_skills,
  kenya_examples,
  skill_timeline,
  prestige_level,
  social_reality,
  alternative_career_slugs,
  complementary_career_slugs,
  updated_at
FROM careers
WHERE slug IS NOT NULL AND title IS NOT NULL;
